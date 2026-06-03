import { Badge } from "@/components/ui/badge";
import type { Outreach } from "@/types";

export function EngagementChip({ outreach }: { outreach: Outreach }) {
  if (outreach.status === "replied") {
    return (
      <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700 text-xs">
        Replied
      </Badge>
    );
  }
  if ((outreach.opens ?? 0) > 0) {
    return (
      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-xs">
        Opened
      </Badge>
    );
  }
  return null;
}

export function OutreachEngagementStats({ outreach }: { outreach: Outreach }) {
  const opens = outreach.opens ?? 0;
  const clicks = outreach.clicks ?? 0;
  if (opens === 0 && clicks === 0 && outreach.status !== "replied") {
    return <span className="text-xs text-muted-foreground">No engagement yet</span>;
  }
  return (
    <span className="text-xs text-muted-foreground">
      {opens > 0 && `${opens} open${opens !== 1 ? "s" : ""}`}
      {opens > 0 && clicks > 0 && " · "}
      {clicks > 0 && `${clicks} click${clicks !== 1 ? "s" : ""}`}
      {outreach.repliedAt && " · Replied"}
    </span>
  );
}
