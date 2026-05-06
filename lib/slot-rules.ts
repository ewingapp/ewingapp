// Dynamic slot-type restriction for psych ANY-type (Range) windows.
//
// In a psych ANY window, an open slot can in principle be booked as either
// MSE (40 min) or Psych Testing (60 min). But if the next booking sits e.g.
// 60 minutes after the slot, putting an MSE there leaves a 20-minute stub
// the doctor can't fill — bad utilization. The rule:
//
//   gap < 60 min  → MSE only (Testing wouldn't fit)
//   60 ≤ gap < 80 → Testing only (MSE would leave a stub <40 min)
//   gap ≥ 80 min  → either (room for an MSE plus another booking)
//
// "gap" only counts a *subsequent booking*. End-of-window leftover doesn't
// count, because no stub is created — the day just ends.

export const MSE_DURATION = 40;
export const TESTING_DURATION = 60;

export type DynamicSlotType = "ANY" | "LOOKALIKE" | "PSYCH_TESTING";

export function gapToNextBookingMinutes(
  slotStartMs: number,
  windowEndMs: number,
  sortedAppointmentStartsMs: number[],
): number | null {
  for (const startMs of sortedAppointmentStartsMs) {
    if (startMs <= slotStartMs) continue;
    if (startMs > windowEndMs) break;
    return (startMs - slotStartMs) / 60_000;
  }
  return null;
}

export function dynamicSlotType(gapMinutes: number | null): DynamicSlotType {
  if (gapMinutes === null) return "ANY";
  if (gapMinutes < TESTING_DURATION) return "LOOKALIKE";
  if (gapMinutes < MSE_DURATION * 2) return "PSYCH_TESTING";
  return "ANY";
}
