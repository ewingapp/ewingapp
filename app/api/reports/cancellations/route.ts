import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") ?? "").trim();
  const to = (searchParams.get("to") ?? "").trim();

  if (!ISO.test(from) || !ISO.test(to)) {
    return NextResponse.json(
      { error: "from and to (YYYY-MM-DD) are required" },
      { status: 400 },
    );
  }

  const appts = await prisma.appointment.findMany({
    where: {
      status: "CANCELLED",
      startTime: { gte: ptStartOfDay(from), lte: ptEndOfDay(to) },
    },
    orderBy: [{ startTime: "asc" }],
    include: {
      doctor: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
      location: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(appts);
}
