import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LATE_CANCEL_WINDOW_MS } from "@/lib/late-cancel";
import { notifyCancellation } from "@/lib/email";
import { getActingBranch } from "@/lib/acting-branch";

const bodySchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
  cancelledByName: z.string().min(1, "Cancelled by is required").max(100),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, status: true, startTime: true, stateBranch: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (existing.status === "CANCELLED" || existing.status === "MOVED") {
    return NextResponse.json(
      { error: "Appointment is already cancelled or moved" },
      { status: 409 },
    );
  }

  // Branch users can only cancel their own appointments, and cancellations
  // are attributed to BRANCH (not VENDOR) so the audit trail is honest.
  const actingBranch = await getActingBranch();
  if (actingBranch && existing.stateBranch !== actingBranch) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  const cancelledAt = new Date();
  const isLate =
    existing.startTime.getTime() - cancelledAt.getTime() < LATE_CANCEL_WINDOW_MS;

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledBy: actingBranch ? "BRANCH" : "VENDOR",
      cancelledByName: parsed.data.cancelledByName,
      cancelledAt,
      statusNote: parsed.data.reason,
      isLateCancellation: isLate,
    },
    include: {
      doctor: { select: { name: true, firstName: true, lastName: true } },
      location: { select: { name: true } },
      specialty: { select: { name: true } },
    },
  });

  // Best-effort notification. Failures are logged inside notifyCancellation
  // and never thrown, so a flaky mail provider can't block the cancel.
  void notifyCancellation(updated);

  return NextResponse.json(updated);
}
