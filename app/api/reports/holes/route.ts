import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Row = {
  doctorId: string;
  doctorName: string;
  doctorFirstName: string;
  doctorLastName: string;
  locationId: string;
  locationName: string;
  scheduledMinutes: number;
  bookedMinutes: number;
  freeMinutes: number;
  appointmentCount: number;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = (searchParams.get("date") ?? "").trim();
  if (!ISO.test(date)) {
    return NextResponse.json(
      { error: "date (YYYY-MM-DD) is required" },
      { status: 400 },
    );
  }

  const dayStart = ptStartOfDay(date);
  const dayEnd = ptEndOfDay(date);

  const [schedules, appts] = await Promise.all([
    prisma.doctorSchedule.findMany({
      where: { startTime: { gte: dayStart, lte: dayEnd } },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            active: true,
          },
        },
        location: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        startTime: { gte: dayStart, lte: dayEnd },
        status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
      },
      select: {
        doctorId: true,
        locationId: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  // Tally minutes per (doctor, location).
  const key = (doctorId: string, locationId: string) =>
    `${doctorId}__${locationId}`;

  type Acc = {
    doctor: {
      id: string;
      name: string;
      firstName: string;
      lastName: string;
      active: boolean;
    };
    location: { id: string; name: string };
    scheduledMs: number;
    bookedMs: number;
    apptCount: number;
  };
  const buckets = new Map<string, Acc>();

  for (const s of schedules) {
    if (!s.doctor.active) continue;
    const k = key(s.doctorId, s.locationId);
    const dur = s.endTime.getTime() - s.startTime.getTime();
    const acc = buckets.get(k);
    if (acc) acc.scheduledMs += dur;
    else
      buckets.set(k, {
        doctor: s.doctor,
        location: s.location,
        scheduledMs: dur,
        bookedMs: 0,
        apptCount: 0,
      });
  }

  for (const a of appts) {
    const k = key(a.doctorId, a.locationId);
    const acc = buckets.get(k);
    if (!acc) continue; // appointment outside any of today's windows
    acc.bookedMs += a.endTime.getTime() - a.startTime.getTime();
    acc.apptCount += 1;
  }

  const rows: Row[] = [];
  for (const acc of buckets.values()) {
    // "Hole" = has at least one booking and still has free time inside the
    // doctor's scheduled windows at that office.
    if (acc.apptCount === 0) continue;
    if (acc.bookedMs >= acc.scheduledMs) continue;
    rows.push({
      doctorId: acc.doctor.id,
      doctorName: acc.doctor.name,
      doctorFirstName: acc.doctor.firstName,
      doctorLastName: acc.doctor.lastName,
      locationId: acc.location.id,
      locationName: acc.location.name,
      scheduledMinutes: Math.round(acc.scheduledMs / 60_000),
      bookedMinutes: Math.round(acc.bookedMs / 60_000),
      freeMinutes: Math.round((acc.scheduledMs - acc.bookedMs) / 60_000),
      appointmentCount: acc.apptCount,
    });
  }

  rows.sort((a, b) => {
    const an = `${a.doctorLastName} ${a.doctorFirstName}`.trim() || a.doctorName;
    const bn = `${b.doctorLastName} ${b.doctorFirstName}`.trim() || b.doctorName;
    return an.localeCompare(bn) || a.locationName.localeCompare(b.locationName);
  });

  return NextResponse.json(rows);
}
