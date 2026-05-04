import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseSyntheticSlotId } from "@/lib/availability";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId") ?? undefined;
  const doctorId = searchParams.get("doctorId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: {
    locationId?: string;
    doctorId?: string;
    startTime?: { gte: Date; lte: Date };
  } = {};
  if (locationId) where.locationId = locationId;
  if (doctorId) where.doctorId = doctorId;
  if (from && to) {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    end.setHours(23, 59, 59, 999);
    where.startTime = { gte: start, lte: end };
  }

  const appts = await prisma.appointment.findMany({
    where,
    orderBy: [{ startTime: "asc" }],
    include: {
      doctor: { select: { id: true, name: true } },
      specialty: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(appts);
}

const bodySchema = z.object({
  slotId: z.string().min(1),
  specialtyId: z.string().min(1),
  caseNumber: z.string().min(1),
  firstInitial: z.string().length(1),
  lastNamePrefix: z.string().min(1).max(5),
  stateBranch: z.string().min(1),
  analystName: z.string().min(1),
  analystPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  schedulerName: z.string().min(1),
  schedulerPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  claimantPhone: z.string().regex(/^\d{1,15}$/).optional().or(z.literal("")),
  contractNumber: z.string().optional(),
  hasInterpreter: z.enum(["yes", "no"]).default("no"),
  isOdarCase: z.enum(["yes", "no"]).default("no"),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const slotKey = parseSyntheticSlotId(data.slotId);
  if (!slotKey) {
    return NextResponse.json({ error: "Invalid slot id" }, { status: 400 });
  }

  try {
    const appointment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const specialty = await tx.specialty.findUnique({
        where: { id: data.specialtyId },
        select: { id: true, durationMinutes: true },
      });
      if (!specialty) throw new Error("SPECIALTY_NOT_FOUND");

      const startTime = slotKey.startTime;
      const endTime = new Date(startTime.getTime() + specialty.durationMinutes * 60_000);

      const window = await tx.doctorSchedule.findFirst({
        where: {
          doctorId: slotKey.doctorId,
          locationId: slotKey.locationId,
          startTime: { lte: startTime },
          endTime: { gte: endTime },
        },
      });
      if (!window) throw new Error("NO_OPEN_WINDOW");

      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId: slotKey.doctorId,
          status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true },
      });
      if (conflict) throw new Error("SLOT_TAKEN");

      const created = await tx.appointment.create({
        data: {
          doctorId: slotKey.doctorId,
          locationId: slotKey.locationId,
          specialtyId: data.specialtyId,
          startTime,
          endTime,
          durationMinutes: specialty.durationMinutes,
          caseNumber: data.caseNumber,
          firstInitial: data.firstInitial.toUpperCase(),
          lastNamePrefix: data.lastNamePrefix.toUpperCase(),
          stateBranch: data.stateBranch,
          analystName: data.analystName,
          analystPhone: data.analystPhone,
          schedulerName: data.schedulerName,
          schedulerPhone: data.schedulerPhone,
          claimantPhone: data.claimantPhone ?? "",
          contractNumber: data.contractNumber ?? "",
          hasInterpreter: data.hasInterpreter,
          isOdarCase: data.isOdarCase,
          notes: data.notes ?? "",
        },
      });

      return created;
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "SPECIALTY_NOT_FOUND") {
      return NextResponse.json({ error: "Specialty not found" }, { status: 404 });
    }
    if (msg === "NO_OPEN_WINDOW") {
      return NextResponse.json(
        { error: "No open schedule window covers that time" },
        { status: 409 },
      );
    }
    if (msg === "SLOT_TAKEN") {
      return NextResponse.json({ error: "That time is no longer available" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
