import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  suffix: z.string().optional().default(""),
  certStatus: z.string().optional().default("BC"),
  languages: z.string().optional().default(""),
  claimantAges: z.string().optional().default(""),
  remarks: z.string().optional().default(""),
  allowVCE: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  notes: z.string().optional().default(""),
});

function buildDisplayName(firstName: string, lastName: string, suffix: string): string {
  return [firstName, lastName, suffix].map((s) => s.trim()).filter(Boolean).join(" ");
}

export async function GET() {
  const doctors = await prisma.doctor.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      suffix: true,
      certStatus: true,
      languages: true,
      claimantAges: true,
      remarks: true,
      allowVCE: true,
      active: true,
      notes: true,
    },
  });
  return NextResponse.json(doctors);
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
  const d = parsed.data;
  const name = buildDisplayName(d.firstName, d.lastName, d.suffix);
  const created = await prisma.doctor.create({
    data: { ...d, name: name || `${d.lastName}` },
  });
  return NextResponse.json(created, { status: 201 });
}
