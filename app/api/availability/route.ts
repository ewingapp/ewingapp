import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const specialtyId = searchParams.get("specialtyId");

  if (!locationId || !specialtyId) {
    return NextResponse.json(
      { error: "locationId and specialtyId required" },
      { status: 400 },
    );
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 120);

  const slots = await prisma.slot.findMany({
    where: {
      locationId,
      specialtyId,
      status: "AVAILABLE",
      startTime: { gte: start, lte: end },
    },
    select: { startTime: true },
  });

  const dates = new Set<string>();
  for (const s of slots) {
    const d = new Date(s.startTime);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.add(`${yyyy}-${mm}-${dd}`);
  }

  return NextResponse.json({ dates: Array.from(dates).sort() });
}
