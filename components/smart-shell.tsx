"use client";

import { AppShell } from "@/components/app-shell";
import { BranchShell } from "@/components/branch-shell";
import { useActingBranch } from "@/lib/use-acting-branch";

// Picks BranchShell for branch sessions and AppShell for vendor sessions.
// The hint cookie set on login tells us which to render — brief flicker on
// the first client render is acceptable.

export function SmartShell({ children }: { children: React.ReactNode }) {
  const actingBranch = useActingBranch();

  if (actingBranch) {
    return <BranchShell actingBranch={actingBranch}>{children}</BranchShell>;
  }

  return <AppShell>{children}</AppShell>;
}
