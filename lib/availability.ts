import { prisma } from "@/lib/db";

export const START_GRAIN_MINUTES = 5;

export type AvailableSlot = {
  id: string;
  startTime: Date;
  endTime: Date;
  doctorId: string;
  doctorName: string;
  locationId: string;
};

type Interval = { start: Date; end: Date };

export function syntheticSlotId(
  doctorId: string,
  locationId: string,
  startTime: Date,
): string {
  return `${doctorId}_${locationId}_${startTime.toISOString()}`;
}

export function parseSyntheticSlotId(
  id: string,
): { doctorId: string; locationId: string; startTime: Date } | null {
  const parts = id.split("_");
  if (parts.length < 3) return null;
  const startIso = parts.slice(2).join("_");
  const startTime = new Date(startIso);
  if (Number.isNaN(startTime.getTime())) return null;
  return { doctorId: parts[0]!, locationId: parts[1]!, startTime };
}

function subtract(windows: Interval[], blocks: Interval[]): Interval[] {
  let free = windows.map((w) => ({ start: new Date(w.start), end: new Date(w.end) }));
  for (const b of blocks) {
    const next: Interval[] = [];
    for (const w of free) {
      if (b.end <= w.start || b.start >= w.end) {
        next.push(w);
        continue;
      }
      if (b.start > w.start) next.push({ start: w.start, end: new Date(Math.min(b.start.getTime(), w.end.getTime())) });
      if (b.end < w.end) next.push({ start: new Date(Math.max(b.end.getTime(), w.start.getTime())), end: w.end });
    }
    free = next.filter((i) => i.end.getTime() > i.start.getTime());
  }
  return free;
}

function ceilToGrain(t: Date, grainMin: number): Date {
  const ms = t.getTime();
  const grainMs = grainMin * 60_000;
  return new Date(Math.ceil(ms / grainMs) * grainMs);
}

export async function computeAvailableSlots(opts: {
  locationId: string;
  specialtyId: string;
  from: Date;
  to: Date;
  doctorId?: string;
}): Promise<AvailableSlot[]> {
  const { locationId, specialtyId, from, to, doctorId } = opts;

  const specialty = await prisma.specialty.findUnique({
    where: { id: specialtyId },
    select: { id: true, name: true, durationMinutes: true },
  });
  if (!specialty) return [];
  const overrides = await prisma.doctorSpecialtyOverride.findMany({
    where: { specialtyId },
    select: { doctorId: true, durationMinutes: true },
  });
  const overrideByDoctor = new Map(
    overrides.map((o) => [o.doctorId, o.durationMinutes]),
  );
  const defaultDuration = specialty.durationMinutes;
  const isMSE = /\bMSE\b/i.test(specialty.name);
  const isPsychTesting = /TESTING/i.test(specialty.name);

  const where: { locationId: string; specialtyId?: never; startTime: { gte: Date; lte: Date }; doctorId?: string; doctor?: { specialties: { some: { id: string } }; active?: boolean } } = {
    locationId,
    startTime: { gte: from, lte: to },
    doctor: { specialties: { some: { id: specialtyId } }, active: true },
  };
  if (doctorId) where.doctorId = doctorId;

  const schedules = await prisma.doctorSchedule.findMany({
    where,
    include: { doctor: { select: { id: true, name: true } } },
    orderBy: [{ startTime: "asc" }],
  });

  if (schedules.length === 0) return [];

  const doctorIds = Array.from(new Set(schedules.map((s) => s.doctorId)));
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: { in: doctorIds },
      startTime: { gte: from, lte: to },
      status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
    },
    select: { doctorId: true, startTime: true, endTime: true },
  });

  const apptByDoctor = new Map<string, Interval[]>();
  for (const a of appointments) {
    const list = apptByDoctor.get(a.doctorId) ?? [];
    list.push({ start: a.startTime, end: a.endTime });
    apptByDoctor.set(a.doctorId, list);
  }

  const out: AvailableSlot[] = [];
  for (const sched of schedules) {
    if (sched.slotType === "LOOKALIKE" && !isMSE) continue;
    if (sched.slotType === "PSYCH_TESTING" && !isPsychTesting) continue;
    const blocks = apptByDoctor.get(sched.doctorId) ?? [];
    const isTypedSlot =
      sched.slotType === "LOOKALIKE" || sched.slotType === "PSYCH_TESTING";
    const duration =
      isTypedSlot && sched.bookingDurationMinutes != null
        ? sched.bookingDurationMinutes
        : (overrideByDoctor.get(sched.doctorId) ?? defaultDuration);
    const durationMs = duration * 60_000;
    // Step the grid at the window's intended slot length when set, so the
    // booking flow shows the same start times as the appointment-slots list.
    // Otherwise fall back to the legacy 5-min grain.
    const stepMinutes = sched.bookingDurationMinutes ?? START_GRAIN_MINUTES;
    const stepMs = stepMinutes * 60_000;
    const free = subtract(
      [{ start: sched.startTime, end: sched.endTime }],
      blocks,
    );
    for (const interval of free) {
      let start =
        sched.bookingDurationMinutes != null
          ? new Date(interval.start)
          : ceilToGrain(interval.start, START_GRAIN_MINUTES);
      while (start.getTime() + durationMs <= interval.end.getTime()) {
        const end = new Date(start.getTime() + durationMs);
        out.push({
          id: syntheticSlotId(sched.doctorId, sched.locationId, start),
          startTime: start,
          endTime: end,
          doctorId: sched.doctorId,
          doctorName: sched.doctor.name,
          locationId: sched.locationId,
        });
        start = new Date(start.getTime() + stepMs);
      }
    }
  }

  out.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return out;
}
