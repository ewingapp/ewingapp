import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, state: true },
  });
  return NextResponse.json(locations);
}
