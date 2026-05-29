import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";

// One-shot bootstrap. Only works when the vendor has no passwordHash yet.
// Sets the vendor's loginId + hashed password, signs the caller in as the
// vendor. Once a password is set, this endpoint refuses — the vendor must
// use /login from then on.

const bodySchema = z.object({
  loginId: z.string().min(3).max(100),
  password: z.string().min(8).max(200),
});

export async function GET() {
  const vendor = await prisma.vendor.findFirst({
    select: { passwordHash: true },
  });
  const needsSetup = !vendor?.passwordHash;
  return NextResponse.json({ needsSetup });
}

export async function POST(request: Request) {
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Login ID must be 3+ chars; password 8+ chars." },
      { status: 400 },
    );
  }

  const existing = await prisma.vendor.findFirst();
  if (existing?.passwordHash) {
    return NextResponse.json(
      { error: "Vendor is already set up. Use /login." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const vendor = existing
    ? await prisma.vendor.update({
        where: { id: existing.id },
        data: { loginId: parsed.data.loginId, passwordHash },
      })
    : await prisma.vendor.create({
        data: { loginId: parsed.data.loginId, passwordHash },
      });

  await setSessionCookie({ kind: "vendor", sub: vendor.id });
  return NextResponse.json({ ok: true });
}
