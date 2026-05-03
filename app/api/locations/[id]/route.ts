import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  phone: z.string().optional(),
  contactName: z.string().optional(),
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
    const updated = await prisma.location.update({
      where: { id },
      data: parsed.data,
    });
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
  const slotCount = await prisma.slot.count({ where: { locationId: id } });
  if (slotCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: this office has slots in the schedule. Set the office inactive instead.",
      },
      { status: 409 },
    );
  }
  try {
    await prisma.location.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
