import { NextResponse } from "next/server";
import { computeAvailableSlots } from "@/lib/availability";
import { ptStartOfDay, ptDateIso, ptTodayIso } from "@/lib/pt";

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

  const start = ptStartOfDay(ptTodayIso());
  const end = new Date(start.getTime() + 120 * 24 * 60 * 60_000);

  const slots = await computeAvailableSlots({
    locationId,
    specialtyId,
    from: start,
    to: end,
  });

  const dates = new Set<string>();
  for (const s of slots) {
    dates.add(ptDateIso(s.startTime));
  }

  return NextResponse.json({ dates: Array.from(dates).sort() });
}
