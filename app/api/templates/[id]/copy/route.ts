import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const source = await prisma.template.findUnique({
    where: { id },
    include: { times: true },
  });
  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let baseName = `${source.name} (copy)`;
  let candidate = baseName;
  let n = 2;
  while (await prisma.template.findUnique({ where: { name: candidate } })) {
    candidate = `${baseName} ${n}`;
    n++;
  }

  const created = await prisma.template.create({
    data: {
      name: candidate,
      disableAutoAdj: source.disableAutoAdj,
      times: {
        create: source.times.map((t) => ({
          hour: t.hour,
          minute: t.minute,
          slotType: t.slotType,
        })),
      },
    },
    include: { times: true },
  });

  return NextResponse.json(created, { status: 201 });
}
