import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const branches = await prisma.stateBranch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(branches);
}
