import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  // Vendor staff see login provisioning state too; everyone else only gets
  // names so the booking form can list options.
  if (session?.kind === "vendor") {
    const branches = await prisma.stateBranch.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, loginId: true, passwordHash: true },
    });
    return NextResponse.json(
      branches.map((b) => ({
        id: b.id,
        name: b.name,
        loginId: b.loginId,
        hasPassword: !!b.passwordHash,
      })),
    );
  }

  const branches = await prisma.stateBranch.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(branches);
}
