import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";

// Vendor-only endpoint that sets or resets a branch's loginId/password.
// Used by /vendor-setup/branch-logins.

const bodySchema = z.object({
  loginId: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Letters, digits, . _ - only"),
  password: z.string().min(8).max(200).optional().or(z.literal("")),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (session?.kind !== "vendor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { loginId, password } = parsed.data;

  const existing = await prisma.stateBranch.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  }

  const data: { loginId: string; passwordHash?: string } = { loginId };
  if (password && password.length > 0) {
    data.passwordHash = await hashPassword(password);
  }

  try {
    const branch = await prisma.stateBranch.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        loginId: true,
        passwordHash: true,
      },
    });
    return NextResponse.json({
      id: branch.id,
      name: branch.name,
      loginId: branch.loginId,
      hasPassword: !!branch.passwordHash,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/Unique constraint/.test(msg)) {
      return NextResponse.json(
        { error: "That login ID is already used by another branch." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
