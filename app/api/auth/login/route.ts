import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

// One endpoint handles both kinds — the body says which.
const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("vendor"),
    loginId: z.string().min(1),
    password: z.string().min(1),
  }),
  z.object({
    kind: z.literal("branch"),
    loginId: z.string().min(1),
    password: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { kind, loginId, password } = parsed.data;

  if (kind === "vendor") {
    const vendor = await prisma.vendor.findFirst();
    if (!vendor || !vendor.loginId || !vendor.passwordHash) {
      return NextResponse.json(
        { error: "Vendor login is not set up yet. Visit /setup." },
        { status: 401 },
      );
    }
    if (vendor.loginId !== loginId) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const ok = await verifyPassword(password, vendor.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    await setSessionCookie({ kind: "vendor", sub: vendor.id });
    return NextResponse.json({ kind: "vendor" });
  }

  // branch
  const branch = await prisma.stateBranch.findUnique({ where: { loginId } });
  if (!branch || !branch.passwordHash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(password, branch.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  await setSessionCookie({
    kind: "branch",
    sub: branch.id,
    branch: branch.name,
  });
  return NextResponse.json({ kind: "branch", branch: branch.name });
}
