"use client";

import { useEffect, useState } from "react";

// Reads a hint left by the auth cookie so client components can decide
// "render BranchShell" vs "render AppShell" without a server roundtrip.
// The HttpOnly session cookie carries the real identity; this hint is just
// a tag ("vendor" or "branch:<name>") that mirrors it.

const HINT_COOKIE = "ewing_session_hint";

export function useActingBranch(): string | null {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    setBranch(readBranchHint());
  }, []);

  return branch;
}

function readBranchHint(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie.split(";").map((c) => c.trim());
  for (const c of cookies) {
    const eq = c.indexOf("=");
    if (eq < 0) continue;
    const name = c.slice(0, eq);
    if (name !== HINT_COOKIE) continue;
    try {
      const value = decodeURIComponent(c.slice(eq + 1));
      if (value.startsWith("branch:")) return value.slice("branch:".length);
      return null;
    } catch {
      return null;
    }
  }
  return null;
}
