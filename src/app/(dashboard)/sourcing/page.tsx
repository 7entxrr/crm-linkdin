"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Radar,
  Plus,
  Play,
  Loader2,
  Trash2,
  Pencil,
  Users,
  MapPin,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HEALTHCARE_ROLES, US_STATES } from "@/lib/constants";
import { formatApolloLocation } from "@/lib/apollo/format-location";
import { getSourcingRules } from "@/lib/services/sourcing-rules";
import { getRecruiters } from "@/lib/services/users";
import { apiFetch } from "@/lib/api-client";
import type { SourcingRule, AppUser } from "@/types";

const ANY_RECRUITER = "__unassigned__";

interface RuleForm {
  id?: string;
  name: string;
  titles: string[];
  state: string;
  city: string;
  perRun: number;
  autoEnroll: boolean;
  enabled: boolean;
  assignedRecruiterId: string;
}

const emptyForm: RuleForm = {
  name: "",
  titles: ["Registered Nurse"],
  state: "",
  city: "",
  perRun: 10,
  autoEnroll: false,
  enabled: true,
  assignedRecruiterId: ANY_RECRUITER,
};

export default function SourcingPage() {
  const [rules, setRules] = useState<SourcingRule[]>([]);
  const [recruiters, setRecruiters] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RuleForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SourcingRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, rec] = await Promise.all([getSourcingRules(), getRecruiters()]);
    setRules(r);
    setRecruiters(rec);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (rule: SourcingRule) => {
    const firstLoc = rule.locations[0] ?? "";
    setForm({
      id: rule.id,
      name: rule.name,
      titles: rule.personTitles,
      state: "",
      city: firstLoc.includes(",") ? firstLoc.split(",")[0].trim() : "",
      perRun: rule.perRun,
      autoEnroll: rule.autoEnroll,
      enabled: rule.enabled,
      assignedRecruiterId: rule.assignedRecruiterId ?? ANY_RECRUITER,
    });
    setFormOpen(true);
  };

  const toggleTitle = (role: string) => {
    setForm((f) => ({
      ...f,
      titles: f.titles.includes(role)
        ? f.titles.filter((t) => t !== role)
        : [...f.titles, role],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Give the rule a name");
      return;
    }
    if (!form.titles.length) {
      toast.error("Select at least one job title");
      return;
    }

    setSaving(true);
    const recruiter = recruiters.find((r) => r.id === form.assignedRecruiterId);
    const payload = {
      id: form.id,
      name: form.name.trim(),
      personTitles: form.titles,
      locations: formatApolloLocation(form.city, form.state),
      perRun: form.perRun,
      autoEnroll: form.autoEnroll,
      enabled: form.enabled,
      assignedRecruiterId:
        form.assignedRecruiterId === ANY_RECRUITER ? "" : form.assignedRecruiterId,
      assignedRecruiterName:
        form.assignedRecruiterId === ANY_RECRUITER ? "" : recruiter?.name ?? "",
    };

    try {
      await apiFetch("/api/sourcing", {
        method: form.id ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(form.id ? "Rule updated" : "Rule created");
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (rule: SourcingRule) => {
    try {
      await apiFetch("/api/sourcing", {
        method: "PATCH",
        body: JSON.stringify({ id: rule.id, enabled: !rule.enabled }),
      });
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  const runRule = async (rule: SourcingRule) => {
    setRunningId(rule.id);
    try {
      const res = (await apiFetch("/api/sourcing/run", {
        method: "POST",
        body: JSON.stringify({ ruleId: rule.id }),
      })) as { imported: number; skipped: number; enrolled: number };
      toast.success(
        `Imported ${res.imported}, skipped ${res.skipped}${
          res.enrolled ? `, enrolled ${res.enrolled}` : ""
        }`
      );
      load();
    } catch (err) {
      const e = err as Error & { upgradeRequired?: boolean };
      toast.error(e.message || "Run failed", {
        description: e.upgradeRequired
          ? "Apollo plan upgrade required for live data."
          : undefined,
      });
    } finally {
      setRunningId(null);
    }
  };

  const runAll = async () => {
    setRunningAll(true);
    try {
      const res = (await apiFetch("/api/sourcing/run", {
        method: "POST",
        body: JSON.stringify({}),
      })) as { rulesProcessed: number; imported: number; skipped: number };
      toast.success(
        `Ran ${res.rulesProcessed} rule(s): imported ${res.imported}, skipped ${res.skipped}`
      );
      load();
    } catch (err) {
      const e = err as Error & { upgradeRequired?: boolean };
      toast.error(e.message || "Run failed", {
        description: e.upgradeRequired
          ? "Apollo plan upgrade required for live data."
          : undefined,
      });
    } finally {
      setRunningAll(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch("/api/sourcing", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      toast.success("Rule deleted");
      setDeleteTarget(null);
      load();
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Auto-Sourcing"
        description="Saved searches that automatically pull, enrich, and import new healthcare candidates on a schedule"
      >
        <Button variant="outline" onClick={runAll} disabled={runningAll || !rules.length}>
          {runningAll ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Run all enabled
        </Button>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border/60 bg-gradient-to-r from-primary/5 to-teal-500/5 px-5 py-4 text-sm text-muted-foreground"
      >
        <p>
          <span className="font-medium text-foreground">How scheduling works:</span>{" "}
          point a cron job at{" "}
          <code className="text-xs">GET /api/sourcing/cron</code> with header{" "}
          <code className="text-xs">Authorization: Bearer $CRON_SECRET</code>. Each run
          searches Apollo, skips duplicates, imports new candidates, and (optionally)
          enrolls them in the follow-up sequence.
        </p>
      </motion.div>

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Radar}
          title="No sourcing rules yet"
          description="Create a rule to continuously source candidates by role and location."
          actionLabel="New Rule"
          onAction={openCreate}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rules.map((rule, i) => (
            <motion.div
              key={rule.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/60 bg-card/90 backdrop-blur-sm transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-teal-500/10 text-primary ring-1 ring-primary/15">
                        <Radar className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{rule.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rule.perRun} per run
                          {rule.autoEnroll && " · auto-enrolls sequence"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleEnabled(rule)}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {rule.personTitles.slice(0, 4).map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">
                        {t}
                      </Badge>
                    ))}
                    {rule.personTitles.length > 4 && (
                      <Badge variant="outline" className="text-xs">
                        +{rule.personTitles.length - 4}
                      </Badge>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {rule.locations.length > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {rule.locations.join(", ")}
                      </span>
                    )}
                    {rule.assignedRecruiterName && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {rule.assignedRecruiterName}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {rule.lastRunAt
                        ? `ran ${formatDistanceToNow(rule.lastRunAt, { addSuffix: true })}`
                        : "never run"}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
                    <p className="text-sm">
                      <span className="font-semibold">{rule.totalImported}</span>{" "}
                      <span className="text-muted-foreground">total imported</span>
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => runRule(rule)}
                        disabled={runningId === rule.id}
                      >
                        {runningId === rule.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Run now
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => openEdit(rule)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(rule)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit rule" : "New sourcing rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Rule name</Label>
              <Input
                placeholder="e.g. Texas RNs"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Job titles</Label>
              <div className="flex flex-wrap gap-2">
                {HEALTHCARE_ROLES.map((role) => (
                  <Badge
                    key={role}
                    variant={form.titles.includes(role) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTitle(role)}
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>State</Label>
                <Select
                  value={form.state || "__any__"}
                  onValueChange={(v) => setForm({ ...form, state: v === "__any__" ? "" : v ?? "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any state">
                      {form.state || "Any state"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="__any__">Any state</SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>City (optional)</Label>
                <Input
                  placeholder="e.g. Houston"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Candidates per run</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.perRun}
                  onChange={(e) =>
                    setForm({ ...form, perRun: parseInt(e.target.value) || 10 })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Assign to recruiter</Label>
                <Select
                  value={form.assignedRecruiterId}
                  onValueChange={(v) =>
                    setForm({ ...form, assignedRecruiterId: v ?? ANY_RECRUITER })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned">
                      {(value) =>
                        value === ANY_RECRUITER
                          ? "Unassigned"
                          : recruiters.find((r) => r.id === value)?.name ??
                            "Unassigned"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_RECRUITER}>Unassigned</SelectItem>
                    {recruiters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Auto-enroll in follow-up sequence</p>
                <p className="text-xs text-muted-foreground">
                  Requires an assigned recruiter. Starts Day 1/3/7/14 emails.
                </p>
              </div>
              <Switch
                checked={form.autoEnroll}
                onCheckedChange={(v) => setForm({ ...form, autoEnroll: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium">Enabled (runs on schedule)</p>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v) => setForm({ ...form, enabled: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {form.id ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.name ?? "rule"}"?`}
        description="This stops the rule from running. Already-imported candidates stay in your CRM."
        confirmLabel="Delete rule"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
