"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Send, Eye, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from "@/lib/services/templates";
import { getCandidates } from "@/lib/services/candidates";
import { renderTemplate } from "@/lib/email/template";
import { TEMPLATE_VARIABLES } from "@/lib/constants";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/rbac";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { EmailTemplate, Candidate } from "@/types";

const SAMPLE_VARS = {
  firstName: "Sarah",
  role: "Registered Nurse",
  location: "Austin, TX",
  company: "Memorial Hospital",
};

function OutreachContent() {
  const searchParams = useSearchParams();
  const { profile, role } = useAuth();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });
  const initialCandidate = searchParams.get("candidate");
  const [candidateIds, setCandidateIds] = useState<string[]>(
    initialCandidate ? [initialCandidate] : []
  );
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidatePickerOpen, setCandidatePickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendForm, setSendForm] = useState({
    templateId: "",
    subject: "",
    body: "",
  });

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      getTemplates(),
      getCandidates({}, isAdmin(role) ? undefined : profile?.id),
    ]);
    setTemplates(t);
    setCandidates(c);
  }, [profile?.id, role]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const candidate = searchParams.get("candidate");
    const subject = searchParams.get("subject");
    const body = searchParams.get("body");
    if (candidate) {
      setCandidateIds([candidate]);
      setSendForm((f) => ({
        ...f,
        subject: subject ? decodeURIComponent(subject) : f.subject,
        body: body ? decodeURIComponent(body) : f.body,
      }));
      setSendOpen(true);
    }
  }, [searchParams]);

  const handleSaveTemplate = async () => {
    if (editing) {
      await updateTemplate(editing.id, form);
      toast.success("Template updated");
    } else {
      await createTemplate({ ...form, createdBy: profile!.id });
      toast.success("Template created");
    }
    setFormOpen(false);
    setEditing(null);
    setForm({ name: "", subject: "", body: "" });
    load();
  };

  const handleSend = async () => {
    if (candidateIds.length === 0) {
      toast.error("Select at least one candidate");
      return;
    }
    setSending(true);
    const results = await Promise.allSettled(
      candidateIds.map((candidateId) =>
        apiFetch("/api/email/send", {
          method: "POST",
          body: JSON.stringify({ ...sendForm, candidateId }),
        })
      )
    );
    setSending(false);

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - sent;

    if (sent > 0) {
      toast.success(
        `Email sent to ${sent} candidate${sent === 1 ? "" : "s"}` +
          (failed > 0 ? ` — ${failed} failed` : "")
      );
    }
    if (failed > 0 && sent === 0) {
      const firstError = results.find(
        (r): r is PromiseRejectedResult => r.status === "rejected"
      );
      toast.error(
        firstError?.reason instanceof Error
          ? firstError.reason.message
          : "Send failed"
      );
    }
    if (sent > 0) setSendOpen(false);
  };

  const toggleCandidate = (id: string) => {
    setCandidateIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const insertVariable = (variable: string) => {
    setForm((f) => ({ ...f, body: f.body + variable }));
  };

  const preview = renderTemplate(
    `Subject: ${form.subject}\n\n${form.body}`,
    SAMPLE_VARS
  );

  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
    );
  }, [candidates, candidateSearch]);

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => candidateIds.includes(c.id)),
    [candidates, candidateIds]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Outreach" description="Email templates and candidate outreach">
        <Button variant="outline" onClick={() => setSendOpen(true)}>
          <Send className="mr-2 h-4 w-4" />Send Email
        </Button>
        <Button onClick={() => { setEditing(null); setForm({ name: "", subject: "", body: "" }); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />New Template
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Card key={t.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{t.subject}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setForm(t); setEditing(t); setFormOpen(true); }}>Edit</Button>
                <Button size="sm" variant="outline" onClick={() => { setSendForm({ ...sendForm, templateId: t.id, subject: t.subject, body: t.body }); setSendOpen(true); }}>
                  <Send className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteId(t.id)}>Delete</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "Template Builder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLES.map((v) => (
                <Button key={v} type="button" variant="outline" size="sm" onClick={() => insertVariable(v)}>
                  {v}
                </Button>
              ))}
            </div>
            <div><Label>Body</Label><Textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
            <Button variant="outline" onClick={() => setPreviewOpen(true)}><Eye className="mr-2 h-4 w-4" />Preview</Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Template Preview</DialogTitle></DialogHeader>
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">{preview}</pre>
        </DialogContent>
      </Dialog>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Outreach Email</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Candidates</Label>
              <Popover open={candidatePickerOpen} onOpenChange={setCandidatePickerOpen}>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-1.5 text-left text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    />
                  }
                >
                  <span className={candidateIds.length ? "" : "text-muted-foreground"}>
                    {candidateIds.length === 0
                      ? "Select candidates"
                      : `${candidateIds.length} candidate${candidateIds.length === 1 ? "" : "s"} selected`}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-(--anchor-width) p-0">
                  <div className="border-b p-2">
                    <Input
                      placeholder="Search candidates..."
                      value={candidateSearch}
                      onChange={(e) => setCandidateSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <ScrollArea className="max-h-60">
                    <div className="p-1">
                      {filteredCandidates.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                          No candidates found
                        </p>
                      ) : (
                        filteredCandidates.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCandidate(c.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <Checkbox checked={candidateIds.includes(c.id)} />
                            <span className="flex-1 truncate">{c.fullName}</span>
                            {c.email ? (
                              <span className="truncate text-xs text-muted-foreground">
                                {c.email}
                              </span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  {candidateIds.length > 0 && (
                    <div className="flex items-center justify-between border-t p-2">
                      <span className="text-xs text-muted-foreground">
                        {candidateIds.length} selected
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setCandidateIds([])}
                      >
                        Clear all
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {selectedCandidates.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedCandidates.map((c) => (
                    <Badge key={c.id} variant="secondary" className="gap-1 pr-1">
                      {c.fullName}
                      <button
                        type="button"
                        onClick={() => toggleCandidate(c.id)}
                        className="rounded-sm p-0.5 hover:bg-foreground/10"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Template (optional)</Label>
              <Select value={sendForm.templateId} onValueChange={(v) => {
                if (!v) return;
                const t = templates.find((t) => t.id === v);
                setSendForm({ ...sendForm, templateId: v, subject: t?.subject ?? "", body: t?.body ?? "" });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select template">
                    {(value) =>
                      templates.find((t) => t.id === value)?.name ??
                      "Select template"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Subject</Label><Input value={sendForm.subject} onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })} /></div>
            <div><Label>Body</Label><Textarea rows={6} value={sendForm.body} onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })} /></div>
            <Button onClick={handleSend} disabled={sending || candidateIds.length === 0}>
              <Send className="mr-2 h-4 w-4" />
              {sending
                ? "Sending..."
                : candidateIds.length > 1
                  ? `Send to ${candidateIds.length} candidates`
                  : "Send Now"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete template?"
        description="This template will be permanently removed."
        onConfirm={async () => {
          if (deleteId) {
            await deleteTemplate(deleteId);
            toast.success("Template deleted");
            setDeleteId(null);
            load();
          }
        }}
      />
    </div>
  );
}

export default function OutreachPage() {
  return (
    <Suspense>
      <OutreachContent />
    </Suspense>
  );
}
