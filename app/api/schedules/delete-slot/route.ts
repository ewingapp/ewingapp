import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  windowId: z.string().min(1),
  slotStart: z.string().min(1),
  slotEnd: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { windowId, slotStart, slotEnd } = parsed.data;
  const start = new Date(slotStart);
  const end = new Date(slotEnd);

  const window = await prisma.doctorSchedule.findUnique({
    where: { id: windowId },
  });
  if (!window) {
    return NextResponse.json({ error: "Window not found" }, { status: 404 });
  }

  const conflict = await prisma.appointment.findFirst({
    where: {
      doctorId: window.doctorId,
      status: { in: ["SCHEDULED", "KEPT", "NO_SHOW"] },
      startTime: { lt: end },
      endTime: { gt: start },
    },
    select: { id: true },
  });
  if (conflict) {
    return NextResponse.json(
      { error: "Slot has a booked appointment. Cancel it first." },
      { status: 409 },
    );
  }

  const trimFront = start.getTime() <= window.startTime.getTime();
  const trimBack = end.getTime() >= window.endTime.getTime();

  if (trimFront && trimBack) {
    await prisma.doctorSchedule.delete({ where: { id: windowId } });
  } else if (trimFront) {
    await prisma.doctorSchedule.update({
      where: { id: windowId },
      data: { startTime: end },
    });
  } else if (trimBack) {
    await prisma.doctorSchedule.update({
      where: { id: windowId },
      data: { endTime: start },
    });
  } else {
    await prisma.$transaction([
      prisma.doctorSchedule.update({
        where: { id: windowId },
        data: { endTime: start },
      }),
      prisma.doctorSchedule.create({
        data: {
          doctorId: window.doctorId,
          locationId: window.locationId,
          startTime: end,
          endTime: window.endTime,
        },
      }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
