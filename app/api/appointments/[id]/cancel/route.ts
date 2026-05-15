import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { LATE_CANCEL_WINDOW_MS } from "@/lib/late-cancel";

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
    select: { id: true, status: true, startTime: true },
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

  const cancelledAt = new Date();
  const isLate =
    existing.startTime.getTime() - cancelledAt.getTime() < LATE_CANCEL_WINDOW_MS;

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledBy: "VENDOR",
      cancelledByName: parsed.data.cancelledByName,
      cancelledAt,
      statusNote: parsed.data.reason,
      isLateCancellation: isLate,
    },
  });

  return NextResponse.json(updated);
}
