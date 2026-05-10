import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  caseNumber: z.string().min(1).max(50),
  firstInitial: z.string().length(1),
  lastNamePrefix: z.string().min(1).max(5),
  stateBranch: z.string().min(1),
  analystName: z.string().min(1),
  analystPhone: z.string().regex(/^\d{10}$/, "10 digits required"),
  analystExt: z
    .string()
    .regex(/^\d{0,10}$/)
    .optional()
    .or(z.literal("")),
  schedulerName: z.string().min(1),
  schedulerPhone: z.string().regex(/^\d{10}$/, "10 digits required"),
  schedulerExt: z
    .string()
    .regex(/^\d{0,10}$/)
    .optional()
    .or(z.literal("")),
  claimantPhone: z
    .string()
    .regex(/^\d{1,15}$/)
    .optional()
    .or(z.literal("")),
  contractNumber: z.string().optional().or(z.literal("")),
  hasInterpreter: z.enum(["yes", "no"]),
  isOdarCase: z.enum(["yes", "no"]),
  notes: z.string().optional().or(z.literal("")),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const appt = await prisma.appointment.findUnique({
    where: { id },
    include: {
      doctor: { select: { id: true, name: true, firstName: true, lastName: true } },
      specialty: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
    },
  });
  if (!appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  return NextResponse.json(appt);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }
  if (existing.status === "CANCELLED" || existing.status === "MOVED") {
    return NextResponse.json(
      { error: "Cannot edit a cancelled or moved appointment" },
      { status: 409 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      caseNumber: data.caseNumber,
      firstInitial: data.firstInitial.toUpperCase(),
      lastNamePrefix: data.lastNamePrefix.toUpperCase(),
      stateBranch: data.stateBranch,
      analystName: data.analystName,
      analystPhone: data.analystPhone,
      analystExt: data.analystExt ?? "",
      schedulerName: data.schedulerName,
      schedulerPhone: data.schedulerPhone,
      schedulerExt: data.schedulerExt ?? "",
      claimantPhone: data.claimantPhone ?? "",
      contractNumber: data.contractNumber ?? "",
      hasInterpreter: data.hasInterpreter,
      isOdarCase: data.isOdarCase,
      notes: data.notes ?? "",
    },
  });

  return NextResponse.json(updated);
}
