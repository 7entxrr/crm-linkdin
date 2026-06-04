import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/constants";
import { sendEmail } from "@/lib/email/mailer";
import { decorateEmail } from "@/lib/email/decorate";
import { renderTemplate, getTemplateVariablesFromCandidate } from "@/lib/email/template";
import type { AuthContext } from "@/lib/auth/server";
import type { CandidateStatus } from "@/types";

const VALID_STATUSES: CandidateStatus[] = [
  "new_lead",
  "contacted",
  "replied",
  "interested",
  "interview_scheduled",
  "closed",
];

export interface ActionResult {
  ok: boolean;
  /** Human-readable summary the model can relay and the UI can display. */
  summary: string;
  /** Whether this result represents a side effect that actually happened. */
  performed?: boolean;
  data?: Record<string, unknown>;
}

type CandidateDoc = FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot;

function canActOnCandidate(auth: AuthContext, data: FirebaseFirestore.DocumentData): boolean {
  return auth.role === "admin" || data.assignedRecruiterId === auth.uid;
}

/** Loads the candidates the user is permitted to see (admin: all, recruiter: assigned). */
async function loadScopedCandidates(db: Firestore, auth: AuthContext) {
  const base = db.collection(COLLECTIONS.candidates);
  const snap =
    auth.role === "admin"
      ? await base.get()
      : await base.where("assignedRecruiterId", "==", auth.uid).get();
  return snap.docs;
}

/**
 * Resolves a candidate reference from either an explicit id or a free-text query
 * (name / email). Returns a single match, a disambiguation list, or nothing.
 */
async function resolveCandidate(
  db: Firestore,
  auth: AuthContext,
  args: { candidateId?: string; query?: string }
): Promise<
  | { kind: "found"; doc: CandidateDoc }
  | { kind: "ambiguous"; matches: { id: string; label: string }[] }
  | { kind: "denied" }
  | { kind: "none" }
> {
  if (args.candidateId) {
    const doc = await db.collection(COLLECTIONS.candidates).doc(args.candidateId).get();
    if (!doc.exists) return { kind: "none" };
    if (!canActOnCandidate(auth, doc.data()!)) return { kind: "denied" };
    return { kind: "found", doc };
  }

  const q = (args.query ?? "").trim().toLowerCase();
  if (!q) return { kind: "none" };

  const docs = await loadScopedCandidates(db, auth);
  const matches = docs.filter((d) => {
    const c = d.data();
    return (
      String(c.fullName ?? "").toLowerCase().includes(q) ||
      String(c.email ?? "").toLowerCase().includes(q)
    );
  });

  if (matches.length === 0) return { kind: "none" };
  if (matches.length === 1) return { kind: "found", doc: matches[0]! };
  return {
    kind: "ambiguous",
    matches: matches.slice(0, 8).map((d) => {
      const c = d.data();
      return { id: d.id, label: `${c.fullName} — ${c.role} (${c.status}) <${c.email}>` };
    }),
  };
}

export async function findCandidatesAction(
  db: Firestore,
  auth: AuthContext,
  args: { query?: string; status?: string; limit?: number }
): Promise<ActionResult> {
  const docs = await loadScopedCandidates(db, auth);
  const q = (args.query ?? "").trim().toLowerCase();
  const status = args.status?.trim();
  const limit = Math.min(Math.max(args.limit ?? 10, 1), 25);

  let results = docs;
  if (status) results = results.filter((d) => d.data().status === status);
  if (q) {
    results = results.filter((d) => {
      const c = d.data();
      return (
        String(c.fullName ?? "").toLowerCase().includes(q) ||
        String(c.email ?? "").toLowerCase().includes(q) ||
        String(c.role ?? "").toLowerCase().includes(q) ||
        String(c.currentEmployer ?? "").toLowerCase().includes(q)
      );
    });
  }

  const list = results.slice(0, limit).map((d) => {
    const c = d.data();
    return {
      id: d.id,
      name: c.fullName,
      role: c.role,
      status: c.status,
      email: c.email,
      location: [c.city, c.state].filter(Boolean).join(", ") || c.location,
      recruiter: c.assignedRecruiterName ?? "unassigned",
    };
  });

  return {
    ok: true,
    summary: `Found ${results.length} matching candidate(s); returning ${list.length}.`,
    data: { count: results.length, candidates: list },
  };
}

export async function sendEmailAction(
  db: Firestore,
  auth: AuthContext,
  args: { candidateId?: string; query?: string; subject?: string; body?: string; confirmed?: boolean }
): Promise<ActionResult> {
  if (!args.subject?.trim() || !args.body?.trim()) {
    return { ok: false, summary: "A subject and body are required to send an email." };
  }

  const resolved = await resolveCandidate(db, auth, args);
  if (resolved.kind === "none")
    return { ok: false, summary: "No matching candidate was found to email." };
  if (resolved.kind === "denied")
    return { ok: false, summary: "You are not assigned to that candidate, so you can't email them." };
  if (resolved.kind === "ambiguous")
    return {
      ok: false,
      summary: "Multiple candidates match. Ask the user which one.",
      data: { matches: resolved.matches },
    };

  const candidate = resolved.doc.data()!;
  const candidateId = resolved.doc.id;

  if (candidate.optedOut) {
    return { ok: false, summary: `${candidate.fullName} has unsubscribed and cannot be emailed.` };
  }
  if (!candidate.email) {
    return { ok: false, summary: `${candidate.fullName} has no email address on file.` };
  }

  const vars = getTemplateVariablesFromCandidate({
    fullName: candidate.fullName,
    role: candidate.role,
    location: candidate.location,
    currentEmployer: candidate.currentEmployer,
  });
  const finalSubject = renderTemplate(args.subject, vars);
  const finalBody = renderTemplate(args.body, vars);

  // Safety: never send without the user's explicit confirmation. When not yet
  // confirmed, return a preview so the model can read it back and ask.
  if (!args.confirmed) {
    return {
      ok: true,
      summary: "PREVIEW ONLY — not sent. Show this to the user and ask them to confirm sending.",
      data: {
        to: `${candidate.fullName} <${candidate.email}>`,
        subject: finalSubject,
        body: finalBody,
        needsConfirmation: true,
      },
    };
  }

  const settingsSnap = await db.collection(COLLECTIONS.settings).doc("app").get();
  const settings = settingsSnap.data();
  if (!settings?.smtp?.host) {
    return { ok: false, summary: "Email could not be sent because SMTP is not configured in Settings." };
  }

  const outreachRef = db.collection(COLLECTIONS.outreachs).doc();
  const decoratedBody = decorateEmail({
    html: finalBody,
    outreachId: outreachRef.id,
    candidateId,
    companyName: settings.companyName,
  });

  try {
    await sendEmail({
      smtp: settings.smtp,
      from: settings.fromEmail,
      to: candidate.email,
      subject: finalSubject,
      html: decoratedBody,
    });

    await outreachRef.set({
      candidateId,
      candidateName: candidate.fullName,
      recruiterId: auth.uid,
      recruiterName: auth.name,
      templateId: null,
      subject: finalSubject,
      body: finalBody,
      channel: "email",
      status: "sent",
      opens: 0,
      clicks: 0,
      sentAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection(COLLECTIONS.messages).add({
      candidateId,
      direction: "outbound",
      subject: finalSubject,
      body: finalBody,
      toEmail: candidate.email,
      outreachId: outreachRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection(COLLECTIONS.activities).add({
      userId: auth.uid,
      userName: auth.name,
      action: "Email sent (AI assistant)",
      entityType: "candidate",
      entityId: candidateId,
      timestamp: FieldValue.serverTimestamp(),
    });

    if (candidate.status === "new_lead") {
      await resolved.doc.ref.update({
        status: "contacted",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      ok: true,
      performed: true,
      summary: `Email sent to ${candidate.fullName} <${candidate.email}> — "${finalSubject}".`,
      data: { candidateId, subject: finalSubject },
    };
  } catch (err) {
    return {
      ok: false,
      summary: `Failed to send email: ${err instanceof Error ? err.message : "unknown error"}.`,
    };
  }
}

function parseDueDate(input?: string): Date {
  if (input) {
    const d = new Date(input);
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Default: tomorrow at 9am local server time.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export async function createTaskAction(
  db: Firestore,
  auth: AuthContext,
  args: { title?: string; description?: string; dueDate?: string; candidateId?: string; candidateQuery?: string }
): Promise<ActionResult> {
  if (!args.title?.trim()) {
    return { ok: false, summary: "A task title is required." };
  }

  let candidateId: string | undefined;
  let candidateName: string | undefined;
  if (args.candidateId || args.candidateQuery) {
    const resolved = await resolveCandidate(db, auth, {
      candidateId: args.candidateId,
      query: args.candidateQuery,
    });
    if (resolved.kind === "found") {
      candidateId = resolved.doc.id;
      candidateName = resolved.doc.data()!.fullName;
    } else if (resolved.kind === "ambiguous") {
      return {
        ok: false,
        summary: "Multiple candidates match for this task. Ask the user which one.",
        data: { matches: resolved.matches },
      };
    }
  }

  const dueAt = parseDueDate(args.dueDate);

  const ref = await db.collection(COLLECTIONS.tasks).add({
    userId: auth.uid,
    userName: auth.name,
    title: args.title.trim(),
    description: args.description?.trim() ?? null,
    candidateId: candidateId ?? null,
    candidateName: candidateName ?? null,
    dueAt,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    performed: true,
    summary: `Task created: "${args.title.trim()}" due ${dueAt.toISOString().slice(0, 16).replace("T", " ")}${
      candidateName ? ` (re: ${candidateName})` : ""
    }.`,
    data: { taskId: ref.id },
  };
}

export async function updateCandidateStatusAction(
  db: Firestore,
  auth: AuthContext,
  args: { candidateId?: string; query?: string; status?: string }
): Promise<ActionResult> {
  if (!args.status || !VALID_STATUSES.includes(args.status as CandidateStatus)) {
    return {
      ok: false,
      summary: `Status must be one of: ${VALID_STATUSES.join(", ")}.`,
    };
  }

  const resolved = await resolveCandidate(db, auth, args);
  if (resolved.kind === "none")
    return { ok: false, summary: "No matching candidate was found." };
  if (resolved.kind === "denied")
    return { ok: false, summary: "You are not assigned to that candidate." };
  if (resolved.kind === "ambiguous")
    return {
      ok: false,
      summary: "Multiple candidates match. Ask the user which one.",
      data: { matches: resolved.matches },
    };

  const candidate = resolved.doc.data()!;
  await resolved.doc.ref.update({
    status: args.status,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection(COLLECTIONS.activities).add({
    userId: auth.uid,
    userName: auth.name,
    action: `Status changed to ${args.status} (AI assistant)`,
    entityType: "candidate",
    entityId: resolved.doc.id,
    timestamp: FieldValue.serverTimestamp(),
  });

  return {
    ok: true,
    performed: true,
    summary: `${candidate.fullName}'s status updated to "${args.status}".`,
    data: { candidateId: resolved.doc.id },
  };
}

/** OpenAI/Groq-compatible tool definitions exposed to the model. */
export const AI_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "find_candidates",
      description:
        "Search the CRM for candidates by name, email, role, employer, and/or status. Use this to look up a candidate's id before sending email or updating status, or to answer questions when the candidate isn't in the provided snapshot.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free text to match name, email, role, or employer." },
          status: {
            type: "string",
            enum: VALID_STATUSES,
            description: "Optional status filter.",
          },
          limit: { type: "number", description: "Max results (1-25, default 10)." },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_email",
      description:
        "Send an outreach email to a candidate. ALWAYS call once with confirmed=false first to generate a preview, show it to the user, and get their explicit approval. Only call again with confirmed=true after the user clearly agrees. Body may use {{firstName}}, {{role}}, {{location}}, {{company}} placeholders.",
      parameters: {
        type: "object",
        properties: {
          candidateId: { type: "string", description: "The candidate's id (preferred). Use find_candidates to get it." },
          query: { type: "string", description: "Candidate name or email if the id is unknown." },
          subject: { type: "string", description: "Email subject line." },
          body: { type: "string", description: "Email body (plain text; newlines become line breaks)." },
          confirmed: {
            type: "boolean",
            description: "Set true ONLY after the user has explicitly approved sending this specific email.",
          },
        },
        required: ["subject", "body"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_task",
      description: "Create a to-do task for the current user, optionally linked to a candidate.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title." },
          description: { type: "string", description: "Optional details." },
          dueDate: {
            type: "string",
            description: "Due date/time in ISO 8601 (e.g. 2026-06-10 or 2026-06-10T15:00). Defaults to tomorrow 9am.",
          },
          candidateId: { type: "string", description: "Optional candidate id to link." },
          candidateQuery: { type: "string", description: "Optional candidate name/email to link if id unknown." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_candidate_status",
      description: "Change a candidate's pipeline status.",
      parameters: {
        type: "object",
        properties: {
          candidateId: { type: "string", description: "The candidate's id (preferred)." },
          query: { type: "string", description: "Candidate name or email if id unknown." },
          status: { type: "string", enum: VALID_STATUSES, description: "New status." },
        },
        required: ["status"],
      },
    },
  },
];

/** Dispatches a tool call by name to its handler. */
export async function executeTool(
  db: Firestore,
  auth: AuthContext,
  name: string,
  args: Record<string, unknown>
): Promise<ActionResult> {
  switch (name) {
    case "find_candidates":
      return findCandidatesAction(db, auth, args);
    case "send_email":
      return sendEmailAction(db, auth, args);
    case "create_task":
      return createTaskAction(db, auth, args);
    case "update_candidate_status":
      return updateCandidateStatusAction(db, auth, args);
    default:
      return { ok: false, summary: `Unknown tool: ${name}` };
  }
}
