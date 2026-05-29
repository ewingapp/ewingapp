import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ptDateIso } from "@/lib/pt";
import { getActingBranch } from "@/lib/acting-branch";

const bodySchema = z.object({
  status: z.enum(["SCHEDULED", "KEPT", "NO_SHOW"]),
  note: z.string().max(500).optional().default(""),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Branch users only view show/no-show; the vendor sets it.
  const actingBranch = await getActingBranch();
  if (actingBranch) {
    return NextResponse.json(
      { error: "Status is set by the vendor" },
      { status: 403 },
    );
  }

  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, status: true, startTime: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (existing.status === "CANCELLED" || existing.status === "MOVED") {
    return NextResponse.json(
      { error: "Cannot change status of a cancelled or moved appointment" },
      { status: 409 },
    );
  }

  const apptDay = ptDateIso(existing.startTime);
  const today = ptDateIso(new Date());
  if (apptDay > today) {
    return NextResponse.json(
      { error: "Status can only be updated on or after the appointment day" },
      { status: 409 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: parsed.data.status,
      statusNote: parsed.data.note ?? "",
    },
  });

  return NextResponse.json(updated);
}
