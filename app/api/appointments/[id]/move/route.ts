import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { parseSyntheticSlotId } from "@/lib/availability";
import { gapToNextBookingMinutes, dynamicSlotType } from "@/lib/slot-rules";
import { ptFmtDateShort, ptFmtTime } from "@/lib/pt";

const bodySchema = z.object({
  slotId: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: originalId } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const slotKey = parseSyntheticSlotId(parsed.data.slotId);
  if (!slotKey) {
    return NextResponse.json({ error: "Invalid slot id" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const original = await tx.appointment.findUnique({
          where: { id: originalId },
        });
        if (!original) throw new Error("ORIGINAL_NOT_FOUND");
        if (original.status === "CANCELLED" || original.status === "MOVED") {
          throw new Error("ALREADY_TERMINAL");
        }

        const specialty = await tx.specialty.findUnique({
          where: { id: original.specialtyId },
          select: { id: true, name: true, durationMinutes: true },
        });
        if (!specialty) throw new Error("SPECIALTY_NOT_FOUND");
        const isMSE = /\bMSE\b/i.test(specialty.name);
        const isPsychTesting = /TESTING/i.test(specialty.name);

        const override = await tx.doctorSpecialtyOverride.findUnique({
          where: {
            doctorId_specialtyId: {
              doctorId: slotKey.doctorId,
              specialtyId: original.specialtyId,
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

        const isTypedSlot =
          window.slotType === "LOOKALIKE" || window.slotType === "PSYCH_TESTING";
        const duration =
          isTypedSlot && window.bookingDurationMinutes != null
            ? window.bookingDurationMinutes
            : (override?.durationMinutes ?? specialty.durationMinutes);
        const endTime = new Date(startTime.getTime() + duration * 60_000);

        if (endTime.getTime() > window.endTime.getTime()) {
          throw new Error("NO_OPEN_WINDOW");
        }

        // Conflict check excludes the original appointment we're moving away from.
        const conflict = await tx.appointment.findFirst({
          where: {
            id: { not: originalId },
            doctorId: slotKey.doctorId,
            status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          select: { id: true },
        });
        if (conflict) throw new Error("SLOT_TAKEN");

        if (window.slotType === "ANY" && (isMSE || isPsychTesting)) {
          const otherAppts = await tx.appointment.findMany({
            where: {
              id: { not: originalId },
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
            specialtyId: original.specialtyId,
            startTime,
            endTime,
            durationMinutes: duration,
            caseNumber: original.caseNumber,
            firstInitial: original.firstInitial,
            lastNamePrefix: original.lastNamePrefix,
            stateBranch: original.stateBranch,
            analystName: original.analystName,
            analystPhone: original.analystPhone,
            analystExt: original.analystExt,
            schedulerName: original.schedulerName,
            schedulerPhone: original.schedulerPhone,
            schedulerExt: original.schedulerExt,
            claimantPhone: original.claimantPhone,
            contractNumber: original.contractNumber,
            hasInterpreter: original.hasInterpreter,
            isOdarCase: original.isOdarCase,
            notes: original.notes,
            scheduledBy: "VENDOR",
          },
        });

        const movedNote = `Moved to ${ptFmtDateShort(startTime)} ${ptFmtTime(startTime)}`;
        await tx.appointment.update({
          where: { id: originalId },
          data: {
            status: "MOVED",
            statusNote: movedNote,
            movedBy: "VENDOR",
            movedAt: new Date(),
          },
        });

        const newAppointmentWithRelations = await tx.appointment.findUnique({
          where: { id: created.id },
          include: {
            doctor: {
              select: { id: true, name: true, firstName: true, lastName: true },
            },
            specialty: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        });

        return { newAppointment: newAppointmentWithRelations, originalId };
      },
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "ORIGINAL_NOT_FOUND") {
      return NextResponse.json({ error: "Original appointment not found" }, { status: 404 });
    }
    if (msg === "ALREADY_TERMINAL") {
      return NextResponse.json(
        { error: "Appointment is already cancelled or moved" },
        { status: 409 },
      );
    }
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
    return NextResponse.json({ error: "Failed to move appointment" }, { status: 500 });
  }
}
