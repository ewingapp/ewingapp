import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay } from "@/lib/pt";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = (searchParams.get("date") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Missing or invalid `date` (expected YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const appts = await prisma.appointment.findMany({
    where: {
      createdAt: { gte: ptStartOfDay(date), lte: ptEndOfDay(date) },
    },
    orderBy: [{ createdAt: "asc" }],
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
