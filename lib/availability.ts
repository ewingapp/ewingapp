import { prisma } from "@/lib/db";
import { gapToNextBookingMinutes, dynamicSlotType } from "@/lib/slot-rules";
import { ptDateIso, PT_TZ } from "@/lib/pt";

export const START_GRAIN_MINUTES = 5;

export type AvailableSlot = {
  id: string;
  startTime: Date;
  endTime: Date;
  doctorId: string;
  doctorName: string;
  doctorFirstName: string;
  doctorLastName: string;
  doctorClaimantAges: string;
  doctorRemarks: string;
  locationId: string;
  isSqueeze?: boolean;
};

// Hour-of-day (0-23) in PT, for AM/PM split of squeeze candidates.
const PT_HOUR_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: PT_TZ,
  hour: "2-digit",
  hour12: false,
});
function ptHourOf(date: Date): number {
  const part = PT_HOUR_FMT.formatToParts(date).find((p) => p.type === "hour");
  const h = Number(part?.value ?? "0");
  return h === 24 ? 0 : h;
}

type Interval = { start: Date; end: Date };

export function syntheticSlotId(
  doctorId: string,
  locationId: string,
  startTime: Date,
): string {
  return `${doctorId}_${locationId}_${startTime.toISOString()}`;
}

// Squeeze slot IDs encode the exact (shortened) duration because the slot
// fits a sub-MSE gap. Format:
//   sq_<doctorId>_<locationId>_<startTimeIso>_<durationMin>
export function syntheticSqueezeSlotId(
  doctorId: string,
  locationId: string,
  startTime: Date,
  durationMin: number,
): string {
  return `sq_${doctorId}_${locationId}_${startTime.toISOString()}_${durationMin}`;
}

export function parseSyntheticSlotId(id: string): {
  doctorId: string;
  locationId: string;
  startTime: Date;
  squeezeDurationMin?: number;
} | null {
  if (id.startsWith("sq_")) {
    const rest = id.slice("sq_".length);
    const parts = rest.split("_");
    if (parts.length < 4) return null;
    const lastIdx = parts.length - 1;
    const durationMin = parseInt(parts[lastIdx]!, 10);
    if (!Number.isFinite(durationMin) || durationMin <= 0) return null;
    const startIso = parts.slice(2, lastIdx).join("_");
    const startTime = new Date(startIso);
    if (Number.isNaN(startTime.getTime())) return null;
    return {
      doctorId: parts[0]!,
      locationId: parts[1]!,
      startTime,
      squeezeDurationMin: durationMin,
    };
  }
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
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          claimantAges: true,
          remarks: true,
        },
      },
    },
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

    // Squeeze 2 windows use their own cadence (30-min squeeze first, then
    // 40 MSE / 60 Testing) and tolerate up to 30 min overflow on the last
    // slot. Handled by a dedicated generator so the existing dynamic-rule
    // loop below stays unchanged for regular windows.
    if (sched.squeeze2 && (isMSE || isPsychTesting)) {
      const sq2 = generateSqueeze2Slots(
        sched,
        blocks,
        isMSE,
        overrideByDoctor.get(sched.doctorId) ?? defaultDuration,
      );
      out.push(...sq2);
      continue;
    }

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
    // Schedules with allowsSqueezes (or the legacy squeeze2 cadence) let the
    // last appointment run up to 30 min past the window end. We model this by
    // extending the effective window end while computing free intervals — any
    // candidate slot whose end falls in the overflow zone is offered, but
    // only the very last slot of the day can actually land there because the
    // cadence has stepped past the original window end by then.
    const overflowMs =
      sched.allowsSqueezes || sched.squeeze2
        ? SQUEEZE2_MAX_OVERFLOW_MIN * 60_000
        : 0;
    const effectiveEnd = new Date(sched.endTime.getTime() + overflowMs);
    const free = subtract(
      [{ start: sched.startTime, end: effectiveEnd }],
      blocks,
    );
    const sortedBlockStartsMs = [...blocks]
      .map((b) => b.start.getTime())
      .sort((a, b) => a - b);
    const windowEndMs = sched.endTime.getTime();
    const applyDynamicRule =
      sched.slotType === "ANY" && (isMSE || isPsychTesting);
    for (const interval of free) {
      let start =
        sched.bookingDurationMinutes != null
          ? new Date(interval.start)
          : ceilToGrain(interval.start, START_GRAIN_MINUTES);
      while (start.getTime() + durationMs <= interval.end.getTime()) {
        if (applyDynamicRule) {
          const gap = gapToNextBookingMinutes(
            start.getTime(),
            windowEndMs,
            sortedBlockStartsMs,
          );
          const dyn = dynamicSlotType(gap);
          if (
            (isMSE && dyn === "PSYCH_TESTING") ||
            (isPsychTesting && dyn === "LOOKALIKE")
          ) {
            start = new Date(start.getTime() + stepMs);
            continue;
          }
        }
        const end = new Date(start.getTime() + durationMs);
        out.push({
          id: syntheticSlotId(sched.doctorId, sched.locationId, start),
          startTime: start,
          endTime: end,
          doctorId: sched.doctorId,
          doctorName: sched.doctor.name,
          doctorFirstName: sched.doctor.firstName ?? "",
          doctorLastName: sched.doctor.lastName ?? "",
          doctorClaimantAges: sched.doctor.claimantAges ?? "",
          doctorRemarks: sched.doctor.remarks ?? "",
          locationId: sched.locationId,
        });
        start = new Date(start.getTime() + stepMs);
      }
    }
  }

  if (isMSE) {
    // Only schedules with allowsSqueezes participate — opt-in per-window
    // by the admin when creating the slot range.
    const squeezeSchedules = schedules.filter((s) => s.allowsSqueezes);
    if (squeezeSchedules.length > 0) {
      const squeezes = findSqueezeSlots({
        schedules: squeezeSchedules,
        apptByDoctor,
        overrideByDoctor,
        defaultDuration,
      });
      const existing = new Set(out.map((s) => s.id));
      for (const sq of squeezes) {
        if (!existing.has(sq.id)) out.push(sq);
      }
    }
  }

  out.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return out;
}

type ScheduleRow = {
  doctorId: string;
  locationId: string;
  startTime: Date;
  endTime: Date;
  slotType: string;
  bookingDurationMinutes: number | null;
  allowsSqueezes: boolean;
  squeeze2: boolean;
  doctor: {
    name: string;
    firstName: string | null;
    lastName: string | null;
    claimantAges: string | null;
    remarks: string | null;
  };
};

// Last-slot overflow tolerated by Squeeze 2 windows (minutes past window end).
export const SQUEEZE2_MAX_OVERFLOW_MIN = 30;
export const SQUEEZE2_SQUEEZE_DURATION_MIN = 30;

// Minimum slot length to bother surfacing as a squeeze. Tiny slivers
// (e.g. 5 min) aren't useful clinically.
const MIN_SQUEEZE_MIN = 15;

// Returns the UTC ms of noon-PT for the same day as the given date.
function noonOfDayMs(date: Date): number {
  const iso = ptDateIso(date); // YYYY-MM-DD in PT
  const [y, m, d] = iso.split("-").map(Number);
  // Build a Date at noon PT by using Intl-aware offset logic. ptWallToUtc
  // exists for this in lib/pt.ts, but we only need ms, so reuse the simple
  // approach: format the input as PT noon and parse back.
  const noonProbe = new Date(Date.UTC(y!, (m! - 1), d!, 19, 0, 0)); // 19:00 UTC ~= noon PDT
  // Adjust for PST (UTC-8) vs PDT (UTC-7). Check the actual PT hour we get.
  const ptHourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    hour: "2-digit",
    hour12: false,
  });
  const probeHour = Number(
    ptHourFmt.formatToParts(noonProbe).find((p) => p.type === "hour")?.value ??
      "0",
  );
  // Add (12 - probeHour) hours to land exactly on noon PT.
  return noonProbe.getTime() + (12 - probeHour) * 60 * 60 * 1000;
}

// Generates slots for a Squeeze 2 window.
// - First slot of the window: 30-min MSE squeeze (only surfaced on MSE search)
// - If the window also spans noon, a second 30-min MSE squeeze appears at
//   the cadence position whose start is the first one >= noon
// - Between squeezes (and after the last squeeze): standard 40-min MSE or
//   60-min Testing cadence
// - On Testing searches: squeeze positions are skipped (squeezes are MSE-only),
//   cadence advances by the squeeze duration anyway so the rest of the day
//   aligns with the MSE view
// - The last slot is allowed to extend up to 30 min past window.endTime
function generateSqueeze2Slots(
  sched: ScheduleRow,
  blocks: Interval[],
  isMSE: boolean,
  mseDurationMin: number,
): AvailableSlot[] {
  const out: AvailableSlot[] = [];
  const testingDurationMin = 60;
  const standardDuration = isMSE ? mseDurationMin : testingDurationMin;
  const squeezeDurationMin = SQUEEZE2_SQUEEZE_DURATION_MIN;
  const noonMs = noonOfDayMs(sched.startTime);
  const windowStartMs = sched.startTime.getTime();
  const windowEndMs = sched.endTime.getTime();
  const maxEndMs = windowEndMs + SQUEEZE2_MAX_OVERFLOW_MIN * 60_000;
  const windowSpansAm = windowStartMs < noonMs;
  const windowSpansPm = windowEndMs > noonMs;

  let cursorMs = windowStartMs;
  let amSqueezeDone = !windowSpansAm;
  let pmSqueezeDone = !windowSpansPm;
  let safety = 1000; // hard cap against infinite loops on bad data

  while (cursorMs < windowEndMs && safety-- > 0) {
    const shouldAm = !amSqueezeDone && cursorMs < noonMs;
    const shouldPm = !pmSqueezeDone && cursorMs >= noonMs;
    const isSqueezeHere = shouldAm || shouldPm;

    if (isSqueezeHere && !isMSE) {
      // Testing search: this cadence position is reserved for an MSE squeeze;
      // skip past it without emitting a slot so the rest of the cadence
      // aligns with the MSE view.
      cursorMs += squeezeDurationMin * 60_000;
      if (shouldAm) amSqueezeDone = true;
      else pmSqueezeDone = true;
      continue;
    }

    const slotDurationMin = isSqueezeHere ? squeezeDurationMin : standardDuration;
    const slotEndMs = cursorMs + slotDurationMin * 60_000;

    if (slotEndMs > maxEndMs) break;

    // Skip the slot if a real booking overlaps it. Cursor still advances to
    // the next cadence position so we don't reuse the conflicting position.
    const conflict = blocks.some(
      (b) => b.start.getTime() < slotEndMs && b.end.getTime() > cursorMs,
    );

    if (!conflict) {
      out.push({
        id: isSqueezeHere
          ? syntheticSqueezeSlotId(
              sched.doctorId,
              sched.locationId,
              new Date(cursorMs),
              squeezeDurationMin,
            )
          : syntheticSlotId(
              sched.doctorId,
              sched.locationId,
              new Date(cursorMs),
            ),
        startTime: new Date(cursorMs),
        endTime: new Date(slotEndMs),
        doctorId: sched.doctorId,
        doctorName: sched.doctor.name,
        doctorFirstName: sched.doctor.firstName ?? "",
        doctorLastName: sched.doctor.lastName ?? "",
        doctorClaimantAges: sched.doctor.claimantAges ?? "",
        doctorRemarks: sched.doctor.remarks ?? "",
        locationId: sched.locationId,
        isSqueeze: isSqueezeHere,
      });
    }

    if (isSqueezeHere) {
      if (shouldAm) amSqueezeDone = true;
      else pmSqueezeDone = true;
    }
    cursorMs = slotEndMs;
  }

  return out;
}

// Squeezes are *short* MSEs that fit a leftover gap between two bookings
// where a normal-length MSE wouldn't fit. The MSE duration is the gap size
// itself (15–39 min). Up to 1 morning + 1 afternoon per doctor per day, on
// `allowsSqueezes` schedules only.
function findSqueezeSlots(opts: {
  schedules: ScheduleRow[];
  apptByDoctor: Map<string, Interval[]>;
  overrideByDoctor: Map<string, number>;
  defaultDuration: number;
}): AvailableSlot[] {
  const { schedules, apptByDoctor, overrideByDoctor, defaultDuration } = opts;

  const schedByDoctor = new Map<string, ScheduleRow[]>();
  for (const s of schedules) {
    const list = schedByDoctor.get(s.doctorId) ?? [];
    list.push(s);
    schedByDoctor.set(s.doctorId, list);
  }

  const out: AvailableSlot[] = [];

  for (const [docId, docScheds] of schedByDoctor) {
    const mseStandardMin = overrideByDoctor.get(docId) ?? defaultDuration;
    const mseStandardMs = mseStandardMin * 60_000;
    const minSqueezeMs = MIN_SQUEEZE_MIN * 60_000;

    const schedByDay = new Map<string, ScheduleRow[]>();
    for (const s of docScheds) {
      const day = ptDateIso(s.startTime);
      const list = schedByDay.get(day) ?? [];
      list.push(s);
      schedByDay.set(day, list);
    }

    const allAppts = apptByDoctor.get(docId) ?? [];

    for (const [day, daySchedules] of schedByDay) {
      const dayAppts = allAppts.filter((a) => ptDateIso(a.start) === day);
      const amCandidates: AvailableSlot[] = [];
      const pmCandidates: AvailableSlot[] = [];

      for (const window of daySchedules) {
        if (window.slotType !== "ANY") continue;

        const wAppts = dayAppts
          .filter(
            (a) => a.start >= window.startTime && a.start < window.endTime,
          )
          .sort((a, b) => a.start.getTime() - b.start.getTime());

        if (wAppts.length === 0) continue;

        for (let i = 0; i < wAppts.length; i++) {
          const appt = wAppts[i]!;
          const gapStart = appt.end;
          const nextEvent = wAppts[i + 1]?.start ?? window.endTime;
          const gapMs = nextEvent.getTime() - gapStart.getTime();

          // Squeeze window: gap is a leftover sliver — too small for a full
          // MSE, big enough to be a real (shortened) appointment.
          if (gapMs < minSqueezeMs) continue;
          if (gapMs >= mseStandardMs) continue;

          const squeezeDurationMin = Math.floor(gapMs / 60_000);

          const slot: AvailableSlot = {
            id: syntheticSqueezeSlotId(
              docId,
              window.locationId,
              gapStart,
              squeezeDurationMin,
            ),
            startTime: gapStart,
            endTime: new Date(gapStart.getTime() + squeezeDurationMin * 60_000),
            doctorId: docId,
            doctorName: window.doctor.name,
            doctorFirstName: window.doctor.firstName ?? "",
            doctorLastName: window.doctor.lastName ?? "",
            doctorClaimantAges: window.doctor.claimantAges ?? "",
            doctorRemarks: window.doctor.remarks ?? "",
            locationId: window.locationId,
            isSqueeze: true,
          };

          if (ptHourOf(gapStart) < 12) amCandidates.push(slot);
          else pmCandidates.push(slot);
        }
      }

      if (amCandidates.length > 0) out.push(amCandidates[0]!);
      if (pmCandidates.length > 0) out.push(pmCandidates[0]!);
    }
  }

  return out;
}
