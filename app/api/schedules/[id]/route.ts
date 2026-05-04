import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sched = await prisma.doctorSchedule.findUnique({ where: { id } });
  if (!sched) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const apptCount = await prisma.appointment.count({
    where: {
      doctorId: sched.doctorId,
      startTime: { gte: sched.startTime, lt: sched.endTime },
      status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
    },
  });
  if (apptCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: this window contains booked appointments. Cancel them first.",
      },
      { status: 409 },
    );
  }
  await prisma.doctorSchedule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
