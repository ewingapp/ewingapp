import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ptStartOfDay, ptEndOfDay, ptTodayIso } from "@/lib/pt";

export async function GET() {
  const today = ptTodayIso();
  const count = await prisma.appointment.count({
    where: {
      status: "SCHEDULED",
      startTime: { gte: ptStartOfDay(today), lte: ptEndOfDay(today) },
    },
  });
  return NextResponse.json({ count, date: today });
}
