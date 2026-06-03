// Returns the State branch the current request is acting as, derived from
// the auth session cookie. Returns null for vendor sessions or unauth.
//
// Same surface as before so callers (the appointment APIs) don't change.

import { getSession } from "./auth";

export async function getActingBranch(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.kind === "branch") return session.branch ?? null;
  return null;
}

// True when the request comes from any branch session (per-branch OR shared
// "any branch" login). Use to authorize branch-side routes without caring
// which specific branch.
export async function isBranchSession(): Promise<boolean> {
  const session = await getSession();
  return session?.kind === "branch";
}
