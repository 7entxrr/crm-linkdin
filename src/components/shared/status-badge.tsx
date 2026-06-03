import { Badge } from "@/components/ui/badge";
import { CANDIDATE_STATUSES } from "@/lib/constants";
import type { CandidateStatus } from "@/types";
import { cn } from "@/lib/utils";

const statusColors: Record<CandidateStatus, string> = {
  new_lead: "bg-blue-50 text-blue-700 border-blue-200",
  contacted: "bg-amber-50 text-amber-700 border-amber-200",
  replied: "bg-teal-50 text-teal-700 border-teal-200",
  interested: "bg-emerald-50 text-emerald-700 border-emerald-200",
  interview_scheduled: "bg-violet-50 text-violet-700 border-violet-200",
  closed: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export function StatusBadge({ status }: { status: CandidateStatus }) {
  const label = CANDIDATE_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <Badge variant="outline" className={cn("font-medium", statusColors[status])}>
      {label}
    </Badge>
  );
}
