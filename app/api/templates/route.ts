import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1, "Required"),
  disableAutoAdj: z.boolean().optional().default(false),
});

export async function GET() {
  const templates = await prisma.template.findMany({
    orderBy: { name: "asc" },
    include: {
      times: {
        orderBy: [{ hour: "asc" }, { minute: "asc" }],
      },
    },
  });
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const created = await prisma.template.create({
      data: parsed.data,
      include: { times: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: `A template named "${parsed.data.name}" already exists.` },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 },
    );
  }
}
