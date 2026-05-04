import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const SLOT_TYPE = z.enum(["ANY", "LOOKALIKE", "PSYCH_TESTING"]);

const createSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  slotType: SLOT_TYPE.optional().default("ANY"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const tmpl = await prisma.template.findUnique({ where: { id } });
  if (!tmpl) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const created = await prisma.templateTime.create({
    data: { templateId: id, ...parsed.data },
  });
  return NextResponse.json(created, { status: 201 });
}
