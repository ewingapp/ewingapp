import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseSyntheticSlotId } from "@/lib/availability";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";
import { gapToNextBookingMinutes, dynamicSlotType } from "@/lib/slot-rules";
import { getActingBranch } from "@/lib/acting-branch";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId") ?? undefined;
  const doctorId = searchParams.get("doctorId") ?? undefined;
  const specialtyId = searchParams.get("specialtyId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const lastName = (searchParams.get("lastName") ?? "").trim();
  const firstInitial = (searchParams.get("firstInitial") ?? "").trim();
  const caseNumber = (searchParams.get("caseNumber") ?? "").trim();
  const noShowOnly = searchParams.get("noShowOnly") === "1";

  const where: Prisma.AppointmentWhereInput = {};
  if (locationId) where.locationId = locationId;
  if (doctorId) where.doctorId = doctorId;
  if (specialtyId) where.specialtyId = specialtyId;
  if (from && to) {
    where.startTime = { gte: ptStartOfDay(from), lte: ptEndOfDay(to) };
  }
  if (lastName) where.lastNamePrefix = { startsWith: lastName.toUpperCase() };
  if (firstInitial) where.firstInitial = firstInitial.charAt(0).toUpperCase();
  if (caseNumber) where.caseNumber = { contains: caseNumber };
  if (noShowOnly) where.status = "NO_SHOW";

  // Branch users only ever see their own branch's appointments. The
  // acting-branch cookie wins over any client-supplied filter so a branch
  // can't peek at another branch by tweaking the URL.
  const actingBranch = await getActingBranch();
  if (actingBranch) where.stateBranch = actingBranch;

  const appts = await prisma.appointment.findMany({
    where,
    orderBy: [{ startTime: "asc" }],
    include: {
      doctor: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
      specialty: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
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
  analystPhone: z.string().regex(/^\d{10}$/, "10 digits required"),
  analystExt: z
    .string()
    .regex(/^\d{0,10}$/, "Digits only")
    .optional()
    .or(z.literal("")),
  schedulerName: z.string().min(1),
  schedulerPhone: z.string().regex(/^\d{10}$/, "10 digits required"),
  schedulerExt: z
    .string()
    .regex(/^\d{0,10}$/, "Digits only")
    .optional()
    .or(z.literal("")),
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

  // If a branch is acting, override stateBranch + scheduledBy from the
  // cookie so a branch can't book under another branch's name.
  const actingBranch = await getActingBranch();
  const effectiveStateBranch = actingBranch ?? data.stateBranch;
  const effectiveScheduledBy: "BRANCH" | "VENDOR" = actingBranch ? "BRANCH" : "VENDOR";

  try {
    const appointment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const specialty = await tx.specialty.findUnique({
        where: { id: data.specialtyId },
        select: { id: true, name: true, durationMinutes: true },
      });
      if (!specialty) throw new Error("SPECIALTY_NOT_FOUND");
      const isMSE = /\bMSE\b/i.test(specialty.name);
      const isPsychTesting = /TESTING/i.test(specialty.name);

      const override = await tx.doctorSpecialtyOverride.findUnique({
        where: {
          doctorId_specialtyId: {
            doctorId: slotKey.doctorId,
            specialtyId: data.specialtyId,
          },
        },
        select: { durationMinutes: true },
      });

      const startTime = slotKey.startTime;

      const window = await tx.doctorSchedule.findFirst({
        where: {
          doctorId: slotKey.doctorId,
          locationId: slotKey.locationId,
          startTime: { lte: startTime },
          endTime: { gt: startTime },
        },
      });
      if (!window) throw new Error("NO_OPEN_WINDOW");

      const isSqueeze = slotKey.squeezeDurationMin != null;
      if (isSqueeze) {
        // Squeezes are MSE-only, on schedules the admin explicitly opted into
        // (either gap-fill `allowsSqueezes` or `squeeze2` cadence).
        if (!isMSE) throw new Error("WRONG_SLOT_TYPE");
        if (!window.allowsSqueezes && !window.squeeze2) {
          throw new Error("WRONG_SLOT_TYPE");
        }
      }

      const isTypedSlot =
        window.slotType === "LOOKALIKE" || window.slotType === "PSYCH_TESTING";
      const duration = isSqueeze
        ? slotKey.squeezeDurationMin!
        : isTypedSlot && window.bookingDurationMinutes != null
          ? window.bookingDurationMinutes
          : (override?.durationMinutes ?? specialty.durationMinutes);
      const endTime = new Date(startTime.getTime() + duration * 60_000);

      // Schedules with allowsSqueezes (or the legacy squeeze2 cadence) let
      // the last slot of the day run up to 30 min past the window end.
      const OVERFLOW_MS = 30 * 60_000;
      const maxEndMs =
        window.allowsSqueezes || window.squeeze2
          ? window.endTime.getTime() + OVERFLOW_MS
          : window.endTime.getTime();
      if (endTime.getTime() > maxEndMs) {
        throw new Error("NO_OPEN_WINDOW");
      }

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

      // The dynamic typing check is the override target for squeezes and the
      // Squeeze 2 cadence — they intentionally place MSEs where the rule
      // would otherwise reserve the time for testing.
      const skipDynamicRule = isSqueeze || window.squeeze2;
      if (
        !skipDynamicRule &&
        window.slotType === "ANY" &&
        (isMSE || isPsychTesting)
      ) {
        const otherAppts = await tx.appointment.findMany({
          where: {
            doctorId: slotKey.doctorId,
            status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
            startTime: { gte: window.startTime, lte: window.endTime },
          },
          select: { startTime: true },
        });
        const startsMs = otherAppts
          .map((a) => a.startTime.getTime())
          .sort((a, b) => a - b);
        const gap = gapToNextBookingMinutes(
          startTime.getTime(),
          window.endTime.getTime(),
          startsMs,
        );
        const dyn = dynamicSlotType(gap);
        if (
          (isMSE && dyn === "PSYCH_TESTING") ||
          (isPsychTesting && dyn === "LOOKALIKE")
        ) {
          throw new Error("WRONG_SLOT_TYPE");
        }
      }

      const created = await tx.appointment.create({
        data: {
          doctorId: slotKey.doctorId,
          locationId: slotKey.locationId,
          specialtyId: data.specialtyId,
          startTime,
          endTime,
          durationMinutes: duration,
          caseNumber: data.caseNumber,
          firstInitial: data.firstInitial.toUpperCase(),
          lastNamePrefix: data.lastNamePrefix.toUpperCase(),
          stateBranch: effectiveStateBranch,
          analystName: data.analystName,
          analystPhone: data.analystPhone,
          analystExt: data.analystExt ?? "",
          schedulerName: data.schedulerName,
          schedulerPhone: data.schedulerPhone,
          schedulerExt: data.schedulerExt ?? "",
          claimantPhone: data.claimantPhone ?? "",
          contractNumber: data.contractNumber ?? "",
          hasInterpreter: data.hasInterpreter,
          isOdarCase: data.isOdarCase,
          notes: data.notes ?? "",
          scheduledBy: effectiveScheduledBy,
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
    if (msg === "WRONG_SLOT_TYPE") {
      return NextResponse.json(
        {
          error:
            "This slot is reserved for a different exam type to avoid leaving an unfillable gap.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
