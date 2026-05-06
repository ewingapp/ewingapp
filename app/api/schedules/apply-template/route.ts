import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ptDateTime } from "@/lib/pt";

const SLOT_TYPE_DURATION: Record<string, number> = {
  ANY: 30,
  LOOKALIKE: 40,
  PSYCH_TESTING: 60,
};

const bodySchema = z.object({
  templateId: z.string().min(1),
  doctorId: z.string().min(1),
  locationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  defaultDuration: z.number().int().min(5).max(240).optional().default(30),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { templateId, doctorId, locationId, date, defaultDuration } = parsed.data;

  const tmpl = await prisma.template.findUnique({
    where: { id: templateId },
    include: { times: true },
  });
  if (!tmpl) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const created = await prisma.$transaction(
    tmpl.times.map((t) => {
      const start = ptDateTime(date, t.hour, t.minute);
      const dur = SLOT_TYPE_DURATION[t.slotType] ?? defaultDuration;
      const end = new Date(start.getTime() + dur * 60_000);
      return prisma.doctorSchedule.create({
        data: {
          doctorId,
          locationId,
          startTime: start,
          endTime: end,
          slotType: t.slotType,
          bookingDurationMinutes: dur,
        },
      });
    }),
  );

  return NextResponse.json({ count: created.length }, { status: 201 });
}
