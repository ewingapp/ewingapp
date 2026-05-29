import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionTokenEdge } from "@/lib/auth-edge";

// Auth gates:
// - /branch/login + /login + /setup + auth APIs are public
// - /branch/* requires a branch session
// - everything else (vendor app pages) requires a vendor session
// API routes follow the same rules as the page they hang off of.

const PUBLIC_PATHS = new Set<string>([
  "/login",
  "/branch/login",
  "/setup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/setup",
]);

function isPublic(path: string): boolean {
  if (PUBLIC_PATHS.has(path)) return true;
  // Next internals / static assets / favicon
  if (path.startsWith("/_next/")) return true;
  if (path === "/favicon.ico") return true;
  if (path.startsWith("/ewing-logo")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET ?? "";
  const session = token ? await verifySessionTokenEdge(token, secret) : null;

  const isBranchPath = pathname === "/branch" || pathname.startsWith("/branch/");

  if (isBranchPath) {
    if (session?.kind === "branch") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/branch/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Vendor area
  if (session?.kind === "vendor") return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Run on every path except next internals and assets.
  matcher: ["/((?!_next/|favicon.ico|ewing-logo).*)"],
};
