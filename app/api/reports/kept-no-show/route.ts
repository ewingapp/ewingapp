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

  const window = {
    gte: ptStartOfDay(from),
    lte: ptEndOfDay(to),
  };

  const [keptCount, noShowCount, noShows] = await Promise.all([
    prisma.appointment.count({
      where: { status: "KEPT", startTime: window },
    }),
    prisma.appointment.count({
      where: { status: "NO_SHOW", startTime: window },
    }),
    prisma.appointment.findMany({
      where: { status: "NO_SHOW", startTime: window },
      orderBy: [{ startTime: "asc" }],
      include: {
        doctor: {
          select: { id: true, name: true, firstName: true, lastName: true },
        },
        specialty: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({ keptCount, noShowCount, noShows });
}
