import { getActingBranch } from "@/lib/acting-branch";
import { BranchResultsView } from "./results-view";

export const dynamic = "force-dynamic";

export default async function BranchResultsPage() {
  // actingBranch may be null when the user signed in with the shared
  // "any branch" login — the form will surface a State Branch dropdown.
  const actingBranch = await getActingBranch();
  return <BranchResultsView actingBranch={actingBranch} />;
}
