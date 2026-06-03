"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEQUENCE_STEPS } from "@/lib/constants";
import { getFollowups } from "@/lib/services/followups";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/rbac";
import type { Followup } from "@/types";

export default function FollowupsPage() {
  const { profile, role } = useAuth();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const all = await getFollowups();
    setFollowups(
      isAdmin(role) ? all : all.filter((f) => f.recruiterId === profile?.id)
    );
  }, [profile?.id, role]);

  useEffect(() => { void load(); }, [load]);

  const runAutomation = async () => {
    setRunning(true);
    try {
      const result = await apiFetch("/api/automation/run", { method: "POST" });
      toast.success(`Processed ${result.processed}, sent ${result.sent}, stopped ${result.stopped}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Automation failed");
    } finally {
      setRunning(false);
    }
  };

  const scheduled = followups.filter((f) => f.status === "scheduled");
  const sent = followups.filter((f) => f.status === "sent");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Automated outreach sequences — Day 1, 3, 7, 14"
      >
        <Button onClick={runAutomation} disabled={running}>
          <Play className="mr-2 h-4 w-4" />
          {running ? "Running..." : "Run Automation Now"}
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sequence Builder</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SEQUENCE_STEPS.map((step) => (
              <div key={step.step} className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarClock className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Day {step.day}</span>
                </div>
                <p className="font-medium">{step.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{step.defaultSubject}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            If candidate status is <strong>Replied</strong>, the sequence stops automatically.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Scheduled ({scheduled.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {scheduled.map((f) => (
              <div key={f.id} className="flex justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{f.candidateName}</p>
                  <p className="text-muted-foreground">{f.sequenceStep} · {format(f.scheduledFor, "PPp")}</p>
                </div>
                <Badge variant="outline">scheduled</Badge>
              </div>
            ))}
            {scheduled.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No scheduled follow-ups</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Sent ({sent.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {sent.map((f) => (
              <div key={f.id} className="flex justify-between rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{f.candidateName}</p>
                  <p className="text-muted-foreground">{f.sequenceStep}</p>
                </div>
                <Badge>sent</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
