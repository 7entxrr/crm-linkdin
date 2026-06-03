"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Phone,
  MapPin,
  Link2,
  ArrowLeft,
  Send,
  CalendarClock,
  Sparkles,
  Loader2,
  Wand2,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { StatusBadge } from "@/components/shared/status-badge";
import { ComplianceBadges } from "@/components/shared/compliance-badges";
import { EngagementChip, OutreachEngagementStats } from "@/components/shared/engagement-chip";
import { PageSkeleton } from "@/components/shared/loading-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getCandidate, updateCandidateStatus } from "@/lib/services/candidates";
import { getNotesByCandidate, createNote, deleteNote } from "@/lib/services/notes";
import { getActivitiesByEntity } from "@/lib/services/activities";
import { getOutreachsByCandidate } from "@/lib/services/outreachs";
import { getFollowupsByCandidate } from "@/lib/services/followups";
import { getMessagesByCandidate } from "@/lib/services/messages";
import { logActivity } from "@/lib/services/activities";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api-client";
import { CANDIDATE_STATUSES } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Candidate, Note, Activity, Outreach, Followup, Message } from "@/types";
import type { CandidateStatus } from "@/types";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

export default function CandidateProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [outreachs, setOutreachs] = useState<Outreach[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [enrichingApollo, setEnrichingApollo] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, n, a, o, f, m] = await Promise.all([
        getCandidate(id),
        getNotesByCandidate(id),
        getActivitiesByEntity("candidate", id),
        getOutreachsByCandidate(id),
        getFollowupsByCandidate(id),
        getMessagesByCandidate(id),
      ]);
      if (!c) {
        router.replace("/candidates");
        return;
      }
      setCandidate(c);
      setNotes(n);
      setActivities(a);
      setOutreachs(o);
      setFollowups(f);
      setMessages(m);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  const handleStatusChange = async (status: CandidateStatus) => {
    if (!candidate) return;
    await updateCandidateStatus(candidate.id, status);
    await logActivity({
      userId: profile!.id,
      userName: profile!.name,
      action: `Status changed to ${status}`,
      entityType: "candidate",
      entityId: candidate.id,
    });
    toast.success("Status updated");
    load();
  };

  const handleAddNote = async () => {
    if (!noteBody.trim() || !candidate) return;
    await createNote({
      candidateId: candidate.id,
      authorId: profile!.id,
      authorName: profile!.name,
      body: noteBody,
    });
    await logActivity({
      userId: profile!.id,
      userName: profile!.name,
      action: "Note added",
      entityType: "candidate",
      entityId: candidate.id,
    });
    setNoteBody("");
    toast.success("Note added");
    load();
  };

  const handleDeleteNote = async () => {
    if (!deleteNoteId) return;
    await deleteNote(deleteNoteId);
    setDeleteNoteId(null);
    toast.success("Note deleted");
    load();
  };

  const handleEnrichApollo = async () => {
    if (!candidate) return;
    setEnrichingApollo(true);
    try {
      await apiFetch("/api/apollo/enrich-candidate", {
        method: "POST",
        body: JSON.stringify({ candidateId: candidate.id }),
      });
      toast.success("Profile enriched — contact details refreshed");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrich failed");
    } finally {
      setEnrichingApollo(false);
    }
  };

  const runAi = async (action: "summarize" | "suggest_next_step" | "draft_email") => {
    if (!candidate) return;
    setAiLoading(action);
    try {
      const res = (await apiFetch("/api/ai", {
        method: "POST",
        body: JSON.stringify({ candidateId: candidate.id, action }),
      })) as {
        summary?: string;
        suggestion?: string;
        subject?: string;
        body?: string;
      };
      if (action === "summarize" && res.summary) setAiSummary(res.summary);
      if (action === "suggest_next_step" && res.suggestion) setAiSuggestion(res.suggestion);
      if (action === "draft_email") {
        toast.success("Draft ready — open Outreach to send");
        router.push(
          `/outreach?candidate=${candidate.id}&subject=${encodeURIComponent(res.subject ?? "")}&body=${encodeURIComponent(res.body ?? "")}`
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI request failed");
    } finally {
      setAiLoading(null);
    }
  };

  const handleScheduleInterview = async () => {
    if (!candidate) return;
    const link =
      process.env.NEXT_PUBLIC_BOOKING_URL ?? "https://calendly.com/your-team/interview";
    await updateCandidateStatus(candidate.id, "interview_scheduled");
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Status set to Interview Scheduled. Booking link copied.");
    load();
  };

  const handleEnroll = async () => {
    try {
      await apiFetch("/api/followups/enroll", {
        method: "POST",
        body: JSON.stringify({ candidateId: id }),
      });
      toast.success("Enrolled in follow-up sequence");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll");
    }
  };

  if (loading || !candidate) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Link href="/candidates" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        <ArrowLeft className="mr-2 h-4 w-4" />Back
      </Link>

      <Card className="border shadow-sm">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{candidate.fullName}</h1>
              <StatusBadge status={candidate.status} />
              <ComplianceBadges candidate={candidate} />
            </div>
            <p className="mt-1 text-muted-foreground">{candidate.role}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {candidate.email ? (
                  candidate.email
                ) : candidate.emailAvailable ? (
                  <span className="italic text-amber-600 dark:text-amber-400">
                    On file — enrich to reveal
                  </span>
                ) : (
                  "—"
                )}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {candidate.phone ? (
                  candidate.phone
                ) : candidate.phoneAvailable ? (
                  <span className="italic text-amber-600 dark:text-amber-400">
                    On file — enrich to reveal
                  </span>
                ) : (
                  "—"
                )}
              </span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{candidate.location || "—"}</span>
              {candidate.linkedinUrl && (
                <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                  <Link2 className="h-4 w-4" />LinkedIn
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={candidate.status} onValueChange={(v) => v && handleStatusChange(v as CandidateStatus)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANDIDATE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handleEnrichApollo}
              disabled={enrichingApollo}
            >
              {enrichingApollo ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Enrich contact
            </Button>
            <Button variant="outline" onClick={handleEnroll}>
              <CalendarClock className="mr-2 h-4 w-4" />Enroll Sequence
            </Button>
            {candidate.status === "interested" && (
              <Button variant="outline" onClick={handleScheduleInterview}>
                <Calendar className="mr-2 h-4 w-4" />Schedule Interview
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => runAi("draft_email")}
              disabled={!!aiLoading}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {aiLoading === "draft_email" ? "Drafting…" : "AI Draft Email"}
            </Button>
            <Link
              href={`/outreach?candidate=${candidate.id}`}
              className={cn(buttonVariants())}
            >
              <Send className="mr-2 h-4 w-4" />Send Outreach
            </Link>
          </div>
        </CardContent>
      </Card>

      {(aiSummary || aiSuggestion) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-2 text-sm">
            {aiSummary && (
              <div>
                <p className="font-medium text-primary">AI Summary</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{aiSummary}</p>
              </div>
            )}
            {aiSuggestion && (
              <div>
                <p className="font-medium text-primary">Suggested next step</p>
                <p className="text-muted-foreground">{aiSuggestion}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => runAi("summarize")} disabled={!!aiLoading}>
                Refresh summary
              </Button>
              <Button size="sm" variant="outline" onClick={() => runAi("suggest_next_step")} disabled={!!aiLoading}>
                Refresh suggestion
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="outreach">Outreach History</TabsTrigger>
          <TabsTrigger value="followups">Followups</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => runAi("summarize")} disabled={!!aiLoading}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              AI Summary
            </Button>
            <Button size="sm" variant="outline" onClick={() => runAi("suggest_next_step")} disabled={!!aiLoading}>
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
              Suggest Next Step
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Experience", candidate.experience],
              ["Employer", candidate.currentEmployer],
              ["Certification", candidate.certification ?? "—"],
              ["City", candidate.city],
              ["State", candidate.state],
              ["Recruiter", candidate.assignedRecruiterName ?? "Unassigned"],
              ["Tags", candidate.tags.join(", ") || "—"],
              ["Source", candidate.source ?? "manual"],
              ["Apollo ID", candidate.apolloId ?? "—"],
              ["Last enriched", candidate.apolloLastEnrichedAt ? format(candidate.apolloLastEnrichedAt, "PPp") : "—"],
              ["Created", format(candidate.createdAt, "PPP")],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
                <CardContent><p className="font-medium">{value}</p></CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="conversation" className="mt-4 space-y-3">
          {messages.length === 0 && outreachs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No messages yet</p>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-xl border p-4 ${
                    msg.direction === "inbound"
                      ? "border-teal-200 bg-teal-50/50 ml-0 mr-8"
                      : "border-border/60 bg-muted/30 ml-8 mr-0"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold capitalize">
                      {msg.direction === "inbound" ? "Candidate" : "You"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(msg.createdAt, "PPp")}
                    </span>
                  </div>
                  {msg.subject && (
                    <p className="text-sm font-medium">{msg.subject}</p>
                  )}
                  <p className="mt-1 text-sm whitespace-pre-wrap">{msg.body}</p>
                </div>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <Textarea placeholder="Add a note..." value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
              <Button onClick={handleAddNote}>Add Note</Button>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium">{note.authorName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{format(note.createdAt, "PPp")}</span>
                      <Button variant="ghost" size="sm" className="text-destructive h-7" onClick={() => setDeleteNoteId(note.id)}>Delete</Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm">{note.body}</p>
                </CardContent>
              </Card>
            ))}
            {notes.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No notes yet</p>}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4 space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-lg border bg-card p-4">
              <div>
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">{a.userName}</p>
              </div>
              <span className="text-xs text-muted-foreground">{format(a.timestamp, "PPp")}</span>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="outreach" className="mt-4 space-y-2">
          {outreachs.map((o) => (
            <Card key={o.id}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium">{o.subject}</p>
                  <EngagementChip outreach={o} />
                </div>
                <p className="text-xs text-muted-foreground mt-1 capitalize">
                  {o.status} · {o.sentAt ? format(o.sentAt, "PPp") : "Pending"}
                </p>
                <div className="mt-2">
                  <OutreachEngagementStats outreach={o} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="followups" className="mt-4 space-y-2">
          {followups.map((f) => (
            <div key={f.id} className="flex justify-between rounded-lg border bg-card p-4">
              <div>
                <p className="font-medium">{f.sequenceStep.replace("_", " ").toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">Scheduled: {format(f.scheduledFor, "PPp")}</p>
              </div>
              <span className="text-sm capitalize">{f.status}</span>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!deleteNoteId}
        onOpenChange={() => setDeleteNoteId(null)}
        title="Delete note?"
        description="This note will be permanently removed."
        onConfirm={handleDeleteNote}
      />
    </div>
  );
}
