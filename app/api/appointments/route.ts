import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

const bodySchema = z.object({
  slotId: z.string().min(1),
  caseNumber: z.string().min(1),
  firstInitial: z.string().length(1),
  lastNamePrefix: z.string().min(1).max(5),
  stateBranch: z.string().min(1),
  analystName: z.string().min(1),
  analystPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  schedulerName: z.string().min(1),
  schedulerPhone: z.string().regex(/^\d{1,15}$/, "Digits only"),
  claimantPhone: z.string().regex(/^\d{1,15}$/).optional().or(z.literal("")),
  contractNumber: z.string().optional(),
  hasInterpreter: z.enum(["yes", "no"]).default("no"),
  isOdarCase: z.enum(["yes", "no"]).default("no"),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  try {
    const appointment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const slot = await tx.slot.findUnique({ where: { id: data.slotId } });
      if (!slot) throw new Error("SLOT_NOT_FOUND");
      if (slot.status !== "AVAILABLE") throw new Error("SLOT_TAKEN");

      const created = await tx.appointment.create({
        data: {
          slotId: data.slotId,
          caseNumber: data.caseNumber,
          firstInitial: data.firstInitial.toUpperCase(),
          lastNamePrefix: data.lastNamePrefix.toUpperCase(),
          stateBranch: data.stateBranch,
          analystName: data.analystName,
          analystPhone: data.analystPhone,
          schedulerName: data.schedulerName,
          schedulerPhone: data.schedulerPhone,
          claimantPhone: data.claimantPhone ?? "",
          contractNumber: data.contractNumber ?? "",
          hasInterpreter: data.hasInterpreter,
          isOdarCase: data.isOdarCase,
          notes: data.notes ?? "",
        },
      });

      await tx.slot.update({
        where: { id: data.slotId },
        data: { status: "BOOKED" },
      });

      return created;
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNKNOWN";
    if (msg === "SLOT_NOT_FOUND") {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 });
    }
    if (msg === "SLOT_TAKEN") {
      return NextResponse.json({ error: "Slot is no longer available" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create appointment" }, { status: 500 });
  }
}
