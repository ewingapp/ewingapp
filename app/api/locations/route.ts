import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1, "Required"),
  address: z.string().optional().default(""),
  address2: z.string().optional().default(""),
  city: z.string().min(1, "Required"),
  state: z.string().optional().default("CA"),
  zip: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  contactName: z.string().optional().default(""),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      address2: true,
      city: true,
      state: true,
      zip: true,
      phone: true,
      contactName: true,
      active: true,
    },
  });
  return NextResponse.json(locations);
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
  const created = await prisma.location.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
