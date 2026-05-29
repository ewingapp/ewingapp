// Returns the State branch the current request is acting as, derived from
// the auth session cookie. Returns null for vendor sessions or unauth.
//
// Same surface as before so callers (the appointment APIs) don't change.

import { getSession } from "./auth";

export async function getActingBranch(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.kind === "branch") return session.branch;
  return null;
}
