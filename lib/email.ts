// Email notifications via Resend's REST API. No SDK dep — uses native fetch.
//
// Configure in Vercel:
//   RESEND_API_KEY    — required to actually send. Without it, sendEmail()
//                       logs and no-ops so dev / preview builds don't crash.
//   EMAIL_FROM        — sender address, e.g. "Ewing Scheduling
//                       <scheduling@ewingdiagnostics.com>". The domain must
//                       be verified in Resend.
//
// All sends are best-effort: failures are logged but never thrown, so a
// flaky email provider doesn't block appointment cancels / reschedules.

import { prisma } from "@/lib/db";
import { ptFmtDateLong, ptFmtTime } from "@/lib/pt";
import { isLateCancel, LATE_CANCEL_WINDOW_HOURS } from "@/lib/late-cancel";

type NotificationKind = "new" | "cancel" | "reschedule";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendArgs): Promise<{ ok: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Ewing Scheduling <onboarding@resend.dev>";
  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY not set — skipping send to ${to}: ${subject}`);
    return { ok: false, reason: "RESEND_API_KEY not set" };
  }
  if (!to) {
    return { ok: false, reason: "missing recipient" };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend returned ${res.status}: ${body}`);
      return { ok: false, reason: `Resend ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false, reason: err instanceof Error ? err.message : "send error" };
  }
}

// Returns the vendor's notification email if they want to receive this kind
// of event, otherwise null. ALWAYS = all three kinds, LIMITED = cancel +
// reschedule only, NEVER = nothing.
async function recipientFor(kind: NotificationKind): Promise<string | null> {
  const vendor = await prisma.vendor.findFirst({
    select: { email: true, appointmentNotification: true },
  });
  if (!vendor) return null;
  if (!vendor.email) return null;
  const pref = vendor.appointmentNotification;
  if (pref === "NEVER") return null;
  if (pref === "LIMITED" && kind === "new") return null;
  return vendor.email;
}

type ApptForEmail = {
  startTime: Date;
  caseNumber: string;
  firstInitial: string;
  lastNamePrefix: string;
  stateBranch: string;
  statusNote?: string | null;
  cancelledAt?: Date | null;
  cancelledByName?: string | null;
  movedAt?: Date | null;
  movedByName?: string | null;
  doctor: { firstName: string; lastName: string; name: string };
  location: { name: string };
  specialty: { name: string };
};

function doctorDisplay(d: { firstName: string; lastName: string; name: string }): string {
  const last = (d.lastName ?? "").trim();
  const first = (d.firstName ?? "").trim();
  if (last && first) return `${last}, ${first}`;
  return (last || first || d.name || "").trim();
}

function appointmentRows(appt: ApptForEmail): string {
  const rows: Array<[string, string]> = [
    ["Case #", appt.caseNumber],
    ["Claimant", `${appt.lastNamePrefix}, ${appt.firstInitial}`],
    ["Branch", appt.stateBranch],
    ["Doctor", doctorDisplay(appt.doctor)],
    ["Office", appt.location.name],
    ["Exam", appt.specialty.name],
    [
      "Appointment",
      `${ptFmtDateLong(appt.startTime)} at ${ptFmtTime(appt.startTime)}`,
    ],
  ];
  return rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#475569;">${escape(
          k,
        )}</td><td style="padding:4px 0;color:#0f172a;font-weight:500;">${escape(v)}</td></tr>`,
    )
    .join("");
}

function escape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrap(title: string, accent: string, body: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.5;margin:0;padding:24px;background:#f8fafc;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <div style="padding:14px 20px;background:${accent};color:#ffffff;font-size:14px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;">${escape(
        title,
      )}</div>
      <div style="padding:20px;">${body}</div>
    </div>
    <p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#64748b;">Sent automatically by Ewing Scheduling.</p>
  </body></html>`;
}

export async function notifyCancellation(appt: ApptForEmail): Promise<void> {
  const to = await recipientFor("cancel");
  if (!to) return;
  const late = isLateCancel({
    status: "CANCELLED",
    cancelledAt: appt.cancelledAt ?? null,
    startTime: appt.startTime,
  });
  const subject = late
    ? `LATE CANCEL (<${LATE_CANCEL_WINDOW_HOURS}h) — Case ${appt.caseNumber}`
    : `Appointment cancelled — Case ${appt.caseNumber}`;
  const lateBanner = late
    ? `<p style="margin:0 0 12px;padding:10px 12px;background:#fee2e2;border-left:4px solid #dc2626;color:#7f1d1d;font-weight:600;">Cancelled less than ${LATE_CANCEL_WINDOW_HOURS} hours before the exam.</p>`
    : "";
  const who = appt.cancelledByName
    ? `<p style="margin:0 0 12px;color:#475569;">Cancelled by <strong>${escape(
        appt.cancelledByName,
      )}</strong>${appt.cancelledAt ? ` on ${escape(ptFmtDateLong(appt.cancelledAt))} at ${escape(ptFmtTime(appt.cancelledAt))}` : ""}.</p>`
    : "";
  const reason = appt.statusNote
    ? `<p style="margin:0 0 12px;color:#475569;"><strong>Reason:</strong> ${escape(appt.statusNote)}</p>`
    : "";
  const body = `${lateBanner}${who}${reason}<table style="border-collapse:collapse;font-size:14px;">${appointmentRows(appt)}</table>`;
  await sendEmail({ to, subject, html: wrap("Cancellation", late ? "#dc2626" : "#475569", body) });
}

export async function notifyReschedule(args: {
  original: ApptForEmail;
  next: ApptForEmail;
}): Promise<void> {
  const to = await recipientFor("reschedule");
  if (!to) return;
  const { original, next } = args;
  const who = next.movedByName
    ? `<p style="margin:0 0 12px;color:#475569;">Moved by <strong>${escape(
        next.movedByName,
      )}</strong>${next.movedAt ? ` on ${escape(ptFmtDateLong(next.movedAt))} at ${escape(ptFmtTime(next.movedAt))}` : ""}.</p>`
    : "";
  const body = `${who}<p style="margin:0 0 6px;color:#475569;font-size:13px;text-transform:uppercase;letter-spacing:.04em;">From</p><table style="border-collapse:collapse;font-size:14px;margin-bottom:16px;">${appointmentRows(
    original,
  )}</table><p style="margin:0 0 6px;color:#475569;font-size:13px;text-transform:uppercase;letter-spacing:.04em;">To</p><table style="border-collapse:collapse;font-size:14px;">${appointmentRows(
    next,
  )}</table>`;
  await sendEmail({
    to,
    subject: `Appointment rescheduled — Case ${original.caseNumber}`,
    html: wrap("Rescheduled", "#06B6D4", body),
  });
}

export async function notifyNewAppointment(appt: ApptForEmail): Promise<void> {
  const to = await recipientFor("new");
  if (!to) return;
  const body = `<p style="margin:0 0 12px;color:#475569;">A new appointment has been scheduled.</p><table style="border-collapse:collapse;font-size:14px;">${appointmentRows(appt)}</table>`;
  await sendEmail({
    to,
    subject: `New appointment — Case ${appt.caseNumber}`,
    html: wrap("New appointment", "#06B6D4", body),
  });
}
