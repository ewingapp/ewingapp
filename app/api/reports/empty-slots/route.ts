import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay, ptDateIso } from "@/lib/pt";
import { computeAvailableSlots } from "@/lib/availability";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

type Row = {
  doctorId: string;
  doctorName: string;
  doctorFirstName: string;
  doctorLastName: string;
  specialtyId: string;
  specialtyName: string;
  date: string;
  locationId: string;
  locationName: string;
  count: number;
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

  // Unique (doctor, location) pairs with at least one schedule window in range,
  // limited to active doctors.
  const scheduleHits = await prisma.doctorSchedule.findMany({
    where: {
      startTime: { gte: fromDate, lte: toDate },
      doctor: { active: true },
    },
    select: { doctorId: true, locationId: true },
  });

  const pairKey = (d: string, l: string) => `${d}__${l}`;
  const pairs = new Set<string>();
  for (const s of scheduleHits) pairs.add(pairKey(s.doctorId, s.locationId));
  if (pairs.size === 0) return NextResponse.json([]);

  const doctorIds = Array.from(new Set(scheduleHits.map((s) => s.doctorId)));
  const locationIds = Array.from(new Set(scheduleHits.map((s) => s.locationId)));

  const [doctors, locations] = await Promise.all([
    prisma.doctor.findMany({
      where: { id: { in: doctorIds } },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        specialties: { select: { id: true, name: true } },
      },
    }),
    prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    }),
  ]);

  const doctorById = new Map(doctors.map((d) => [d.id, d]));
  const locById = new Map(locations.map((l) => [l.id, l]));

  const rows: Row[] = [];
  for (const pair of pairs) {
    const [doctorId, locationId] = pair.split("__");
    const doctor = doctorById.get(doctorId);
    const location = locById.get(locationId);
    if (!doctor || !location) continue;
    for (const sp of doctor.specialties) {
      const slots = await computeAvailableSlots({
        doctorId,
        locationId,
        specialtyId: sp.id,
        from: fromDate,
        to: toDate,
      });
      if (slots.length === 0) continue;
      const byDate = new Map<string, number>();
      for (const slot of slots) {
        const d = ptDateIso(slot.startTime);
        byDate.set(d, (byDate.get(d) ?? 0) + 1);
      }
      for (const [date, count] of byDate) {
        rows.push({
          doctorId,
          doctorName: doctor.name,
          doctorFirstName: doctor.firstName,
          doctorLastName: doctor.lastName,
          specialtyId: sp.id,
          specialtyName: sp.name,
          date,
          locationId,
          locationName: location.name,
          count,
        });
      }
    }
  }

  rows.sort((a, b) => {
    const an = `${a.doctorLastName} ${a.doctorFirstName}`.trim() || a.doctorName;
    const bn = `${b.doctorLastName} ${b.doctorFirstName}`.trim() || b.doctorName;
    return (
      an.localeCompare(bn) ||
      a.date.localeCompare(b.date) ||
      a.specialtyName.localeCompare(b.specialtyName) ||
      a.locationName.localeCompare(b.locationName)
    );
  });

  return NextResponse.json(rows);
}
