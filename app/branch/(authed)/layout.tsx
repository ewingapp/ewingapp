import { getActingBranch } from "@/lib/acting-branch";
import { BranchShell } from "@/components/branch-shell";

export const dynamic = "force-dynamic";

export default async function AuthedBranchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware has already enforced a branch session before we render.
  const actingBranch = await getActingBranch();
  return <BranchShell actingBranch={actingBranch}>{children}</BranchShell>;
}
