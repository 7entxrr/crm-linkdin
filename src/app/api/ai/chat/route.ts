import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken, type AuthContext } from "@/lib/auth/server";
import { COLLECTIONS } from "@/lib/constants";
import { AI_TOOLS, executeTool, type ActionResult } from "@/lib/ai/actions";

type ChatRole = "user" | "assistant";
interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** OpenAI/Groq chat message shape used when talking to the provider. */
interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_HISTORY = 16;
const CANDIDATE_SAMPLE = 150;
const MAX_TOOL_ROUNDS = 5;

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const v = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
  if (typeof v.toDate === "function") return v.toDate();
  const secs = v._seconds ?? v.seconds;
  if (typeof secs === "number") return new Date(secs * 1000);
  return null;
}

function fmtDate(value: unknown): string {
  const d = asDate(value);
  return d ? d.toISOString().slice(0, 10) : "—";
}

/**
 * Reads the CRM data the requesting user is allowed to see and renders it into a
 * compact text block the LLM can reason over. Recruiters are scoped to their own
 * assigned candidates / outreach / tasks; admins see everything.
 */
async function buildCrmContext(auth: AuthContext): Promise<string> {
  const db = getAdminDb();
  const isAdmin = auth.role === "admin";

  const candidatesQuery = isAdmin
    ? db.collection(COLLECTIONS.candidates)
    : db.collection(COLLECTIONS.candidates).where("assignedRecruiterId", "==", auth.uid);

  const [candidatesSnap, usersSnap, outreachSnap, tasksSnap] = await Promise.all([
    candidatesQuery.get(),
    isAdmin ? db.collection(COLLECTIONS.users).get() : null,
    db.collection(COLLECTIONS.outreachs).get(),
    db
      .collection(COLLECTIONS.tasks)
      .where("userId", "==", auth.uid)
      .where("status", "==", "pending")
      .get(),
  ]);

  const candidates = candidatesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>);

  const byStatus = new Map<string, number>();
  const byRole = new Map<string, number>();
  const byState = new Map<string, number>();
  let optedOut = 0;
  let bounced = 0;
  for (const c of candidates) {
    const status = String(c.status ?? "unknown");
    const role = String(c.role ?? "unknown");
    const state = String(c.state ?? "unknown");
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    byRole.set(role, (byRole.get(role) ?? 0) + 1);
    byState.set(state, (byState.get(state) ?? 0) + 1);
    if (c.optedOut) optedOut++;
    if (c.emailBounced) bounced++;
  }

  const allowedCandidateIds = new Set(candidates.map((c) => String(c.id)));
  const outreachRaw = outreachSnap.docs.map((d) => d.data() as Record<string, unknown>);
  const outreach = isAdmin
    ? outreachRaw
    : outreachRaw.filter(
        (o) =>
          o.recruiterId === auth.uid || allowedCandidateIds.has(String(o.candidateId ?? ""))
      );

  const sent = outreach.filter((o) => o.status === "sent" || o.status === "replied").length;
  const replied = outreach.filter((o) => o.status === "replied").length;
  const opened = outreach.filter((o) => Number(o.opens ?? 0) > 0).length;
  const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;

  const topEntries = (m: Map<string, number>, n: number) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

  const lines: string[] = [];
  lines.push(`SCOPE: ${isAdmin ? "Admin — full CRM access." : "Recruiter — only candidates/outreach/tasks assigned to this user."}`);
  lines.push("");
  lines.push("=== SUMMARY ===");
  lines.push(`Total candidates: ${candidates.length}`);
  lines.push(`Candidates by status: ${topEntries(byStatus, 10) || "none"}`);
  lines.push(`Top roles: ${topEntries(byRole, 8) || "none"}`);
  lines.push(`Top states: ${topEntries(byState, 8) || "none"}`);
  lines.push(`Opted out: ${optedOut} | Bounced emails: ${bounced}`);
  lines.push(
    `Outreach: ${outreach.length} total, ${sent} sent, ${replied} replied (reply rate ${replyRate}%, open rate ${openRate}%).`
  );

  if (isAdmin && usersSnap) {
    const recruiters = usersSnap.docs
      .map((d) => d.data() as Record<string, unknown>)
      .filter((u) => u.status === "active");
    lines.push("");
    lines.push("=== RECRUITERS ===");
    for (const r of recruiters.slice(0, 30)) {
      lines.push(`- ${r.name ?? r.email} (${r.role ?? "recruiter"})`);
    }
  }

  const tasks = tasksSnap.docs.map((d) => d.data() as Record<string, unknown>);
  if (tasks.length) {
    lines.push("");
    lines.push("=== YOUR PENDING TASKS ===");
    for (const t of tasks.slice(0, 20)) {
      lines.push(`- ${t.title} (due ${fmtDate(t.dueAt)})${t.candidateName ? ` re: ${t.candidateName}` : ""}`);
    }
  }

  const sortedCandidates = [...candidates].sort((a, b) => {
    const da = asDate(a.createdAt)?.getTime() ?? 0;
    const dbb = asDate(b.createdAt)?.getTime() ?? 0;
    return dbb - da;
  });

  lines.push("");
  lines.push(`=== CANDIDATES (showing ${Math.min(CANDIDATE_SAMPLE, sortedCandidates.length)} of ${candidates.length}, most recent first) ===`);
  lines.push("Format: name | role | location | status | employer | recruiter | tags | created");
  for (const c of sortedCandidates.slice(0, CANDIDATE_SAMPLE)) {
    const loc = [c.city, c.state].filter(Boolean).join(", ") || c.location || "—";
    const tags = Array.isArray(c.tags) && c.tags.length ? (c.tags as string[]).join("/") : "—";
    lines.push(
      `- ${c.fullName ?? "Unknown"} | ${c.role ?? "—"} | ${loc} | ${c.status ?? "—"} | ${c.currentEmployer ?? "—"} | ${c.assignedRecruiterName ?? "unassigned"} | ${tags} | ${fmtDate(c.createdAt)}`
    );
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI is not configured. Set GROQ_API_KEY in the environment." },
      { status: 503 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = (await request.json()) as { messages?: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history = incoming
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY);

  if (history.length === 0 || history[history.length - 1]!.role !== "user") {
    return NextResponse.json({ error: "A user message is required" }, { status: 400 });
  }

  let context: string;
  try {
    context = await buildCrmContext(auth);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load CRM context" },
      { status: 500 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const systemPrompt = [
    `You are the AI assistant embedded in "Nightingale Recruit", a healthcare recruiting CRM.`,
    `You are chatting with ${auth.name} (${auth.email}), whose role is "${auth.role}". Today is ${today}.`,
    ``,
    `You have live, read-only access to a snapshot of this user's CRM data, provided below.`,
    `Answer questions about candidates, recruiters, outreach performance, tasks, and pipeline using ONLY this data.`,
    `Guidelines:`,
    `- Be concise and specific. Use numbers and names from the data.`,
    `- Use short markdown (bullets, bold) when it helps readability.`,
    `- If the answer is not in the provided data, say so plainly and suggest where in the CRM to look. Never invent candidates, numbers, or contact details.`,
    `- The candidate list is a recent sample and may be truncated; if a count is needed, prefer the SUMMARY aggregates and note when the detail list is partial.`,
    ``,
    `You can also TAKE ACTIONS on the user's behalf using the provided tools:`,
    `- find_candidates: look up candidates (use this to get a candidate's id before acting).`,
    `- send_email: send outreach email to a candidate.`,
    `- create_task: add a to-do for the user.`,
    `- update_candidate_status: move a candidate to a new pipeline stage.`,
    `Action rules:`,
    `- Before SENDING an email or CHANGING a status, you MUST confirm with the user first. For email, call send_email with confirmed=false to produce a preview, show the recipient/subject/body, and ask the user to approve. Only call send_email again with confirmed=true after they explicitly say yes.`,
    `- When a tool needs a candidate id you don't have, call find_candidates first. If a name is ambiguous, ask the user which person they mean.`,
    `- After an action succeeds, briefly confirm what you did. If it fails, explain why plainly. Never claim to have done something a tool didn't actually perform.`,
    `- Recruiters can only act on candidates assigned to them; respect any permission errors returned by tools.`,
    ``,
    `===== CRM DATA SNAPSHOT =====`,
    context,
    `===== END CRM DATA =====`,
  ].join("\n");

  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content }) as LlmMessage),
  ];
  const performedActions: { summary: string; ok: boolean }[] = [];

  const db = getAdminDb();

  async function callGroq(): Promise<
    { ok: true; message: { content?: string; tool_calls?: ToolCall[] } } | { ok: false; status: number; detail: string }
  > {
    let res: Response;
    try {
      res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 1000,
          tools: AI_TOOLS,
          tool_choice: "auto",
          messages,
        }),
      });
    } catch {
      return { ok: false, status: 502, detail: "Could not reach the AI provider" };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, status: 502, detail: detail.slice(0, 300) };
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string; tool_calls?: ToolCall[] } }[];
    };
    return { ok: true, message: data.choices?.[0]?.message ?? {} };
  }

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const result = await callGroq();
    if (!result.ok) {
      return NextResponse.json(
        { error: `AI request failed.`, detail: result.detail },
        { status: result.status }
      );
    }

    const { content, tool_calls } = result.message;

    if (!tool_calls || tool_calls.length === 0) {
      const reply = content?.trim();
      if (!reply) {
        return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
      }
      return NextResponse.json({ reply, actions: performedActions });
    }

    // Record the assistant's tool-call turn, then execute each call.
    messages.push({ role: "assistant", content: content ?? null, tool_calls });

    for (const call of tool_calls) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parsed = {};
      }

      let actionResult: ActionResult;
      try {
        actionResult = await executeTool(db, auth, call.function.name, parsed);
      } catch (err) {
        actionResult = {
          ok: false,
          summary: `Tool "${call.function.name}" errored: ${err instanceof Error ? err.message : "unknown"}.`,
        };
      }

      if (actionResult.performed) {
        performedActions.push({ summary: actionResult.summary, ok: actionResult.ok });
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(actionResult),
      });
    }
  }

  // Hit the tool-round ceiling without a final text answer.
  return NextResponse.json(
    {
      reply:
        "I started working on that but hit my action limit for this turn. Here's what happened so far — let me know if you'd like me to continue.",
      actions: performedActions,
    },
  );
}
