import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const specialtyId = searchParams.get("specialtyId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!locationId || !specialtyId || !from || !to) {
    return NextResponse.json(
      { error: "locationId, specialtyId, from, and to are required" },
      { status: 400 },
    );
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const slots = await prisma.slot.findMany({
    where: {
      locationId,
      specialtyId,
      status: "AVAILABLE",
      startTime: { gte: fromDate, lte: toDate },
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      doctor: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(slots);
}
