import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const exams = await prisma.exam.findMany({
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, active: true },
  });
  return NextResponse.json(exams);
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
    const created = await prisma.exam.create({ data: parsed.data });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: `An exam with code "${parsed.data.code}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to create exam" }, { status: 500 });
  }
}
