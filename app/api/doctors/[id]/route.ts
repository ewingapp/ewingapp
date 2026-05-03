import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  suffix: z.string().optional(),
  certStatus: z.string().optional(),
  languages: z.string().optional(),
  claimantAges: z.string().optional(),
  remarks: z.string().optional(),
  allowVCE: z.boolean().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
});

function buildDisplayName(firstName: string, lastName: string, suffix: string): string {
  return [firstName, lastName, suffix].map((s) => s.trim()).filter(Boolean).join(" ");
}

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

  const data: Record<string, unknown> = { ...parsed.data };

  if (
    parsed.data.firstName !== undefined ||
    parsed.data.lastName !== undefined ||
    parsed.data.suffix !== undefined
  ) {
    const current = await prisma.doctor.findUnique({
      where: { id },
      select: { firstName: true, lastName: true, suffix: true, name: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const fn = parsed.data.firstName ?? current.firstName;
    const ln = parsed.data.lastName ?? current.lastName;
    const sf = parsed.data.suffix ?? current.suffix;
    const newName = buildDisplayName(fn, ln, sf);
    if (newName) data.name = newName;
  }

  try {
    const updated = await prisma.doctor.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slotCount = await prisma.slot.count({ where: { doctorId: id } });
  if (slotCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: doctor has slots in the schedule. Set the doctor inactive instead.",
      },
      { status: 409 },
    );
  }
  try {
    await prisma.doctor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
