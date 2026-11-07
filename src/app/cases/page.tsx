import { CasesExplorer } from "@/components/CasesExplorer";

// Static shell (no server data fetching) so the route itself can be served from
// cache offline. CasesExplorer loads cases client-side (IndexedDB first, then the
// network).
export default function CasesPage() {
  return <CasesExplorer />;
}
