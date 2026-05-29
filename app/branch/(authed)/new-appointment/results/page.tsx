import { redirect } from "next/navigation";
import { getActingBranch } from "@/lib/acting-branch";
import { BranchResultsView } from "./results-view";

export const dynamic = "force-dynamic";

export default async function BranchResultsPage() {
  const actingBranch = await getActingBranch();
  if (!actingBranch) redirect("/branch");
  return <BranchResultsView actingBranch={actingBranch} />;
}
