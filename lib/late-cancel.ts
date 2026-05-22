// "Late cancellation" rule: the cancel was recorded less than 48 hours
// before the appointment start. The `Appointment.isLateCancellation` flag
// is set on cancel for forward data, but compute from `cancelledAt` and
// `startTime` as a fallback so older rows still render correctly.

export const LATE_CANCEL_WINDOW_HOURS = 48;
export const LATE_CANCEL_WINDOW_MS = LATE_CANCEL_WINDOW_HOURS * 60 * 60 * 1000;

export function isLateCancel(appt: {
  status?: string;
  cancelledAt?: string | Date | null;
  startTime?: string | Date | null;
  isLateCancellation?: boolean | null;
}): boolean {
  if (appt.status !== "CANCELLED") return false;
  if (appt.isLateCancellation) return true;
  if (!appt.cancelledAt || !appt.startTime) return false;
  const cancelMs =
    typeof appt.cancelledAt === "string"
      ? new Date(appt.cancelledAt).getTime()
      : appt.cancelledAt.getTime();
  const startMs =
    typeof appt.startTime === "string"
      ? new Date(appt.startTime).getTime()
      : appt.startTime.getTime();
  if (Number.isNaN(cancelMs) || Number.isNaN(startMs)) return false;
  return startMs - cancelMs < LATE_CANCEL_WINDOW_MS;
}
