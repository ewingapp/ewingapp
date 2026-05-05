import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const CATEGORY = z.enum(["PSYCH", "MEDICAL", "SLP"]);

const createSchema = z.object({
  name: z.string().min(1, "Required"),
  code: z.string().optional().default(""),
  category: CATEGORY.optional().default("MEDICAL"),
  durationMinutes: z.number().int().min(5).max(240).optional().default(30),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");

  const where = locationId
    ? {
        doctors: {
          some: {
            active: true,
            locations: { some: { id: locationId } },
          },
        },
      }
    : undefined;

  const specialties = await prisma.specialty.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      durationMinutes: true,
    },
  });
  return NextResponse.json(specialties);
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const data = { ...parsed.data, name: parsed.data.name.toUpperCase() };
    const created = await prisma.specialty.create({ data });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: `A specialty named "${parsed.data.name}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create specialty" },
      { status: 500 },
    );
  }
}
