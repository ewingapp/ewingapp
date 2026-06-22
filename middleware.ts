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

// Shared appointment pages that live outside /branch but are SmartShell-based
// and scope themselves to the acting branch — so a branch session may use them
// (View / Edit / Move launched from the branch portal). The vendor-only list
// at exactly "/appointments" is intentionally excluded.
function isBranchSharedPage(path: string): boolean {
  if (path.startsWith("/reschedule/")) return true;
  if (/^\/appointments\/[^/]+/.test(path)) return true; // /appointments/<id>[/edit]
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET ?? "";
  const session = token ? await verifySessionTokenEdge(token, secret) : null;

  const isBranchPath = pathname === "/branch" || pathname.startsWith("/branch/");
  const isApiPath = pathname.startsWith("/api/");

  if (isBranchPath) {
    if (session?.kind === "branch") return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/branch/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // API routes are reachable by either vendor or branch sessions; each
  // handler does its own finer-grained authorization (some are vendor-only,
  // some scope by acting branch).
  if (isApiPath) {
    if (session) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Branch sessions may also reach the shared, branch-scoped appointment
  // pages (View / Edit / Move) even though they live outside /branch.
  if (session?.kind === "branch" && isBranchSharedPage(pathname)) {
    return NextResponse.next();
  }

  // Vendor pages
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
