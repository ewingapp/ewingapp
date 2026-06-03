// Edge-safe subset of auth helpers, used by middleware.ts. No imports from
// `next/headers` or Node-only modules — keeps the middleware bundle small.

import { jwtVerify } from "jose";

export const SESSION_COOKIE = "ewing_session";
const ISSUER = "ewingapp";
const AUDIENCE = "ewingapp";

export type Session =
  | { kind: "vendor"; sub: string }
  | { kind: "branch"; sub: string; branch?: string };

export async function verifySessionTokenEdge(
  token: string,
  secret: string,
): Promise<Session | null> {
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { issuer: ISSUER, audience: AUDIENCE },
    );
    if (payload.kind === "vendor" && typeof payload.sub === "string") {
      return { kind: "vendor", sub: payload.sub };
    }
    if (payload.kind === "branch" && typeof payload.sub === "string") {
      const branch =
        typeof payload.branch === "string" ? payload.branch : undefined;
      return { kind: "branch", sub: payload.sub, branch };
    }
    return null;
  } catch {
    return null;
  }
}
