// Session auth: bcryptjs for password hashing + jose for signed JWT cookies.
//
// One cookie carries the whole session payload: { kind, sub, branch? }.
// - kind = "vendor": shared vendor staff session
// - kind = "branch": per-branch session; `branch` is the branch name
//
// The cookie is HttpOnly + signed with AUTH_SECRET so the client can't forge
// it. Middleware verifies it without hitting the DB, so it works on the Edge.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "ewing_session";
// Companion non-HttpOnly cookie that just tells the client "you're vendor"
// or "you're branch <name>". Useful for client components (SmartShell)
// that need to pick a shell without a server roundtrip. Carries no secret.
export const SESSION_HINT_COOKIE = "ewing_session_hint";
const ISSUER = "ewingapp";
const AUDIENCE = "ewingapp";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 2 weeks

export type Session =
  | { kind: "vendor"; sub: string }
  | { kind: "branch"; sub: string; branch: string };

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is missing or too short. Set it (>= 32 chars) in .env / Vercel project settings.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(session: Session): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (payload.kind === "vendor" && typeof payload.sub === "string") {
      return { kind: "vendor", sub: payload.sub };
    }
    if (
      payload.kind === "branch" &&
      typeof payload.sub === "string" &&
      typeof payload.branch === "string"
    ) {
      return { kind: "branch", sub: payload.sub, branch: payload.branch };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return await verifySessionToken(token);
}

export async function setSessionCookie(session: Session): Promise<void> {
  const token = await signSession(session);
  const jar = await cookies();
  jar.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  const hint = session.kind === "branch" ? `branch:${session.branch}` : "vendor";
  jar.set({
    name: SESSION_HINT_COOKIE,
    value: hint,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  for (const name of [SESSION_COOKIE, SESSION_HINT_COOKIE]) {
    jar.set({
      name,
      value: "",
      httpOnly: name === SESSION_COOKIE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
}

// Password helpers. Imported only from Node.js route handlers — never from
// middleware (bcryptjs is heavy and runs on Node anyway).
export async function hashPassword(plain: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return await bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return await bcrypt.compare(plain, hashed);
}
