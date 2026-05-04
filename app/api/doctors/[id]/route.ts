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
  locationIds: z.array(z.string()).optional(),
  specialtyIds: z.array(z.string()).optional(),
  examIds: z.array(z.string()).optional(),
  durationOverrides: z
    .array(
      z.object({
        specialtyId: z.string().min(1),
        durationMinutes: z.number().int().min(5).max(240),
      }),
    )
    .optional(),
});

const overrideInclude = {
  locations: { select: { id: true, name: true } },
  specialties: { select: { id: true, name: true, code: true, category: true } },
  exams: { select: { id: true, code: true, name: true, category: true } },
  overrides: { select: { id: true, specialtyId: true, durationMinutes: true } },
} as const;

function buildDisplayName(firstName: string, lastName: string, suffix: string): string {
  return [firstName, lastName, suffix].map((s) => s.trim()).filter(Boolean).join(" ");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doctor = await prisma.doctor.findUnique({
    where: { id },
    include: overrideInclude,
  });
  if (!doctor) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(doctor);
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

  const {
    locationIds,
    specialtyIds,
    examIds,
    durationOverrides,
    ...scalar
  } = parsed.data;

  const data: Record<string, unknown> = { ...scalar };

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

  if (locationIds !== undefined) {
    data.locations = { set: locationIds.map((id) => ({ id })) };
  }
  if (specialtyIds !== undefined) {
    data.specialties = { set: specialtyIds.map((id) => ({ id })) };
  }
  if (examIds !== undefined) {
    data.exams = { set: examIds.map((id) => ({ id })) };
  }

  try {
    if (durationOverrides !== undefined) {
      const keepIds = new Set(durationOverrides.map((o) => o.specialtyId));
      await prisma.doctorSpecialtyOverride.deleteMany({
        where: { doctorId: id, specialtyId: { notIn: [...keepIds] } },
      });
      for (const o of durationOverrides) {
        await prisma.doctorSpecialtyOverride.upsert({
          where: {
            doctorId_specialtyId: { doctorId: id, specialtyId: o.specialtyId },
          },
          create: {
            doctorId: id,
            specialtyId: o.specialtyId,
            durationMinutes: o.durationMinutes,
          },
          update: { durationMinutes: o.durationMinutes },
        });
      }
    }
    const updated = await prisma.doctor.update({
      where: { id },
      data,
      include: overrideInclude,
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
  const apptCount = await prisma.appointment.count({ where: { doctorId: id } });
  if (apptCount > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete: doctor has appointments. Set the doctor inactive instead.",
      },
      { status: 409 },
    );
  }
  await prisma.doctorSchedule.deleteMany({ where: { doctorId: id } });
  try {
    await prisma.doctor.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
