import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = (searchParams.get("doctorId") ?? "").trim();
  const locationId = (searchParams.get("locationId") ?? "").trim();
  const from = (searchParams.get("from") ?? "").trim();
  const to = (searchParams.get("to") ?? "").trim();

  if (!ISO.test(from) || !ISO.test(to)) {
    return NextResponse.json(
      { error: "from and to (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  const where: {
    startTime: { gte: Date; lte: Date };
    doctorId?: string;
    locationId?: string;
  } = {
    startTime: { gte: ptStartOfDay(from), lte: ptEndOfDay(to) },
  };
  if (doctorId) where.doctorId = doctorId;
  if (locationId) where.locationId = locationId;

  const appts = await prisma.appointment.findMany({
    where,
    orderBy: [{ startTime: "asc" }],
    include: {
      doctor: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
      specialty: { select: { id: true, name: true, code: true } },
      location: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(appts);
}
