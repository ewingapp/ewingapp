import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  doctorId: z.string().min(1),
});

// Dedicated doctor-only reassignment so reports and other surfaces can swap
// the doctor on an appointment without re-sending every editable field.
// Validation mirrors PATCH /api/appointments/[id].
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { doctorId } = parsed.data;

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      doctorId: true,
      specialtyId: true,
      locationId: true,
    },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 },
    );
  }
  if (existing.status === "CANCELLED" || existing.status === "MOVED") {
    return NextResponse.json(
      { error: "Cannot reassign a cancelled or moved appointment" },
      { status: 409 },
    );
  }
  if (doctorId === existing.doctorId) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  const candidate = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      active: true,
      locations: { select: { id: true } },
      specialties: { select: { id: true } },
    },
  });
  if (!candidate) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 400 });
  }
  if (!candidate.active) {
    return NextResponse.json(
      { error: "Cannot reassign to an inactive doctor" },
      { status: 400 },
    );
  }
  if (!candidate.specialties.some((s) => s.id === existing.specialtyId)) {
    return NextResponse.json(
      { error: "Doctor does not handle this exam type" },
      { status: 400 },
    );
  }
  if (!candidate.locations.some((l) => l.id === existing.locationId)) {
    return NextResponse.json(
      { error: "Doctor is not assigned to this office" },
      { status: 400 },
    );
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { doctorId: candidate.id },
    include: {
      doctor: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
    },
  });

  return NextResponse.json(updated);
}
