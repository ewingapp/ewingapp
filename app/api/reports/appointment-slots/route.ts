import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";
import { gapToNextBookingMinutes, dynamicSlotType } from "@/lib/slot-rules";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const FALLBACK_GRID_MIN = 30;

type OutSlot = {
  startTime: string;
  endTime: string;
  locationId: string;
  locationName: string;
  slotType: "ANY" | "LOOKALIKE" | "PSYCH_TESTING";
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = (searchParams.get("doctorId") ?? "").trim();
  const from = (searchParams.get("from") ?? "").trim();
  const to = (searchParams.get("to") ?? "").trim();

  if (!doctorId || !ISO.test(from) || !ISO.test(to)) {
    return NextResponse.json(
      { error: "doctorId, from (YYYY-MM-DD), and to (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  const fromDate = ptStartOfDay(from);
  const toDate = ptEndOfDay(to);

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      specialties: { select: { category: true } },
    },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }
  const doctorIsPsych = doctor.specialties.some((s) => s.category === "PSYCH");

  const [schedules, appts] = await Promise.all([
    prisma.doctorSchedule.findMany({
      where: {
        doctorId,
        startTime: { gte: fromDate, lte: toDate },
      },
      orderBy: [{ startTime: "asc" }],
      include: {
        location: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        doctorId,
        startTime: { gte: fromDate, lte: toDate },
        status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
      },
      select: { startTime: true, endTime: true },
    }),
  ]);

  const sortedAppts = [...appts].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime(),
  );
  const sortedApptStartsMs = sortedAppts.map((a) => a.startTime.getTime());

  const rows: OutSlot[] = [];
  for (const w of schedules) {
    const gridMin = w.bookingDurationMinutes ?? FALLBACK_GRID_MIN;
    const stepMs = gridMin * 60_000;
    const winEnd = w.endTime.getTime();
    let cursor = w.startTime.getTime();
    while (cursor + stepMs <= winEnd + 1) {
      const slotEnd = cursor + stepMs;
      const overlap = sortedAppts.find(
        (a) => a.startTime.getTime() < slotEnd && a.endTime.getTime() > cursor,
      );
      if (overlap) {
        cursor = overlap.endTime.getTime();
        continue;
      }
      let slotType: OutSlot["slotType"] = w.slotType as OutSlot["slotType"];
      if (w.slotType === "ANY" && doctorIsPsych) {
        const gap = gapToNextBookingMinutes(cursor, winEnd, sortedApptStartsMs);
        slotType = dynamicSlotType(gap);
      }
      rows.push({
        startTime: new Date(cursor).toISOString(),
        endTime: new Date(slotEnd).toISOString(),
        locationId: w.locationId,
        locationName: w.location.name,
        slotType,
      });
      cursor += stepMs;
    }
  }

  rows.sort(
    (a, b) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );

  return NextResponse.json(rows);
}
