import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_STEP_MINUTES = 30;

type Row = {
  doctorId: string;
  doctorName: string;
  doctorFirstName: string;
  doctorLastName: string;
  totalSlots: number;
  scheduled: number;
  pctFilled: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") ?? "").trim();
  const to = (searchParams.get("to") ?? "").trim();
  if (!ISO.test(from) || !ISO.test(to)) {
    return NextResponse.json(
      { error: "from and to (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  const fromDate = ptStartOfDay(from);
  const toDate = ptEndOfDay(to);

  const [schedules, appts] = await Promise.all([
    prisma.doctorSchedule.findMany({
      where: {
        startTime: { gte: fromDate, lte: toDate },
        doctor: { active: true },
      },
      select: {
        doctorId: true,
        startTime: true,
        endTime: true,
        slotType: true,
        bookingDurationMinutes: true,
        doctor: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            specialties: { select: { id: true, durationMinutes: true } },
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: {
        startTime: { gte: fromDate, lte: toDate },
        status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
      },
      select: { doctorId: true },
    }),
  ]);

  // Primary step per doctor for untyped (ANY) windows: the smallest specialty
  // duration the doctor handles, or DEFAULT_STEP_MINUTES if they have no
  // specialties on record. Using min() gives a generous slot count for
  // ANY windows — a window that can fit any of N exam types fits more of the
  // shortest one.
  const stepByDoctor = new Map<string, number>();

  type Acc = {
    doctor: {
      id: string;
      name: string;
      firstName: string;
      lastName: string;
    };
    totalSlots: number;
    scheduled: number;
  };
  const byDoctor = new Map<string, Acc>();

  for (const s of schedules) {
    if (!stepByDoctor.has(s.doctorId)) {
      const durations = s.doctor.specialties
        .map((sp) => sp.durationMinutes)
        .filter((d) => d > 0);
      const step =
        durations.length > 0 ? Math.min(...durations) : DEFAULT_STEP_MINUTES;
      stepByDoctor.set(s.doctorId, step);
    }
    const stepMin =
      s.bookingDurationMinutes ?? stepByDoctor.get(s.doctorId) ?? DEFAULT_STEP_MINUTES;
    if (stepMin <= 0) continue;
    const windowMin =
      (s.endTime.getTime() - s.startTime.getTime()) / 60_000;
    const slotsInWindow = Math.max(0, Math.floor(windowMin / stepMin));

    const acc = byDoctor.get(s.doctorId);
    if (acc) acc.totalSlots += slotsInWindow;
    else
      byDoctor.set(s.doctorId, {
        doctor: {
          id: s.doctor.id,
          name: s.doctor.name,
          firstName: s.doctor.firstName,
          lastName: s.doctor.lastName,
        },
        totalSlots: slotsInWindow,
        scheduled: 0,
      });
  }

  for (const a of appts) {
    const acc = byDoctor.get(a.doctorId);
    if (acc) acc.scheduled += 1;
  }

  const rows: Row[] = [];
  for (const acc of byDoctor.values()) {
    const pct =
      acc.totalSlots > 0
        ? Math.round((acc.scheduled / acc.totalSlots) * 100)
        : 0;
    rows.push({
      doctorId: acc.doctor.id,
      doctorName: acc.doctor.name,
      doctorFirstName: acc.doctor.firstName,
      doctorLastName: acc.doctor.lastName,
      totalSlots: acc.totalSlots,
      scheduled: acc.scheduled,
      pctFilled: pct,
    });
  }

  rows.sort((a, b) => {
    const an = `${a.doctorLastName} ${a.doctorFirstName}`.trim() || a.doctorName;
    const bn = `${b.doctorLastName} ${b.doctorFirstName}`.trim() || b.doctorName;
    return an.localeCompare(bn);
  });

  return NextResponse.json(rows);
}
