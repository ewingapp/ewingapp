import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; timeId: string }> },
) {
  const { id, timeId } = await params;
  try {
    await prisma.templateTime.delete({
      where: { id: timeId, templateId: id },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
