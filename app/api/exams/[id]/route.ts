import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const CATEGORY = z.enum(["PSYCH", "MEDICAL", "SLP"]);

const updateSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  category: CATEGORY.optional(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await request.json();
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const data = parsed.data.name
      ? { ...parsed.data, name: parsed.data.name.toUpperCase() }
      : parsed.data;
    const updated = await prisma.exam.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: `An exam with code "${parsed.data.code}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.exam.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
