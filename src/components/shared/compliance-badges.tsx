import { Badge } from "@/components/ui/badge";
import type { Candidate } from "@/types";

export function ComplianceBadges({ candidate }: { candidate: Candidate }) {
  if (!candidate.optedOut && !candidate.emailBounced) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {candidate.optedOut && (
        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 text-xs">
          Unsubscribed
        </Badge>
      )}
      {candidate.emailBounced && (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 text-xs">
          Bounced
        </Badge>
      )}
    </div>
  );
}
