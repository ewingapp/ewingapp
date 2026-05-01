import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const specialties = await prisma.specialty.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(specialties);
}
