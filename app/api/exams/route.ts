import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const CATEGORY = z.enum(["PSYCH", "MEDICAL", "SLP"]);

const createSchema = z.object({
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  category: CATEGORY.optional().default("MEDICAL"),
  durationMinutes: z.number().int().min(5).max(240).optional().default(30),
  active: z.boolean().optional().default(true),
});

export async function GET() {
  const exams = await prisma.exam.findMany({
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      category: true,
      durationMinutes: true,
      active: true,
    },
  });
  const sorted = [...exams].sort((a, b) => {
    if (a.code === "MSE") return -1;
    if (b.code === "MSE") return 1;
    return a.code.localeCompare(b.code);
  });
  return NextResponse.json(sorted);
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
    const created = await prisma.exam.create({ data });
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
