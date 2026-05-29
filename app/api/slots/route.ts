import { NextResponse } from "next/server";
import { computeAvailableSlots } from "@/lib/availability";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const specialtyId = searchParams.get("specialtyId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const doctorId = searchParams.get("doctorId") ?? undefined;

  if (!locationId || !specialtyId || !from || !to) {
    return NextResponse.json(
      { error: "locationId, specialtyId, from, and to are required" },
      { status: 400 },
    );
  }

  const slots = await computeAvailableSlots({
    locationId,
    specialtyId,
    from: ptStartOfDay(from),
    to: ptEndOfDay(to),
    doctorId,
  });

  return NextResponse.json(
    slots.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      isSqueeze: s.isSqueeze ?? false,
      doctor: {
        id: s.doctorId,
        name: s.doctorName,
        firstName: s.doctorFirstName,
        lastName: s.doctorLastName,
        claimantAges: s.doctorClaimantAges,
        remarks: s.doctorRemarks,
      },
    })),
  );
}
