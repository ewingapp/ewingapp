import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const SLOT_TYPE = z.enum(["ANY", "LOOKALIKE", "PSYCH_TESTING"]);

const createSchema = z.object({
  doctorId: z.string().min(1),
  locationId: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  slotType: SLOT_TYPE.optional().default("ANY"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const doctorId = searchParams.get("doctorId") ?? undefined;
  const date = searchParams.get("date");

  const where: { locationId?: string; doctorId?: string; startTime?: { gte: Date; lte: Date } } = {};
  if (locationId) where.locationId = locationId;
  if (doctorId) where.doctorId = doctorId;
  if (date) {
    const d = new Date(`${date}T00:00:00`);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    where.startTime = { gte: d, lte: end };
  }

  const schedules = await prisma.doctorSchedule.findMany({
    where,
    orderBy: [{ startTime: "asc" }],
    include: {
      doctor: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(schedules);
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { doctorId, locationId, startTime, endTime, slotType } = parsed.data;
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  if (end <= start) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 },
    );
  }

  const created = await prisma.doctorSchedule.create({
    data: { doctorId, locationId, startTime: start, endTime: end, slotType },
    include: {
      doctor: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(created, { status: 201 });
}
