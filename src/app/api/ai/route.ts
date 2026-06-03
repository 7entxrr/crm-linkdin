import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/server";
import { COLLECTIONS } from "@/lib/constants";
import { getTemplateVariablesFromCandidate } from "@/lib/email/template";

type AiAction = "draft_email" | "summarize" | "suggest_next_step";

async function callLlm(prompt: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.7,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? null;
}

function fallbackDraft(vars: ReturnType<typeof getTemplateVariablesFromCandidate>) {
  return {
    subject: `Healthcare opportunity for {{role}} professionals`,
    body: `Hi ${vars.firstName},\n\nI came across your background as a ${vars.role} in ${vars.location} and thought you might be interested in an exciting opportunity we're recruiting for.\n\nWould you be open to a brief conversation this week?\n\nBest regards,\nNightingale Recruit`,
  };
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidateId, action } = (await request.json()) as {
    candidateId: string;
    action: AiAction;
  };

  if (!candidateId || !action) {
    return NextResponse.json({ error: "candidateId and action required" }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.candidates).doc(candidateId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const c = snap.data()!;
  const vars = getTemplateVariablesFromCandidate({
    fullName: c.fullName,
    role: c.role,
    location: c.location,
    currentEmployer: c.currentEmployer,
  });

  const context = `Candidate: ${c.fullName}, Role: ${c.role}, Location: ${c.location}, Employer: ${c.currentEmployer}, Status: ${c.status}, Experience: ${c.experience}`;

  if (action === "draft_email") {
    const prompt = `Write a short professional recruitment email (subject + body) for a healthcare recruiter reaching out to this candidate. Use a warm tone. Context: ${context}. Return JSON: {"subject":"...","body":"..."}`;
    const llm = await callLlm(prompt);
    if (llm) {
      try {
        const parsed = JSON.parse(llm.replace(/```json\n?|\n?```/g, ""));
        return NextResponse.json({ ...parsed, source: "ai" });
      } catch {
        return NextResponse.json({
          subject: `Opportunity for ${vars.firstName}`,
          body: llm,
          source: "ai",
        });
      }
    }
    return NextResponse.json({ ...fallbackDraft(vars), source: "template" });
  }

  if (action === "summarize") {
    const prompt = `Summarize this healthcare recruitment candidate in 2-3 bullet points for a recruiter dashboard. ${context}`;
    const summary = await callLlm(prompt);
    return NextResponse.json({
      summary:
        summary ??
        `• ${c.fullName} is a ${c.role} based in ${c.location}\n• Currently at ${c.currentEmployer}\n• Status: ${c.status}`,
      source: summary ? "ai" : "template",
    });
  }

  if (action === "suggest_next_step") {
    const prompt = `Given this candidate's recruitment status, suggest ONE clear next action for the recruiter (one sentence). Context: ${context}`;
    const step = await callLlm(prompt);
    const fallbacks: Record<string, string> = {
      new_lead: "Send an initial outreach email and enroll in the follow-up sequence.",
      contacted: "Wait for a reply or send a gentle follow-up in 2-3 days.",
      replied: "Review their reply and schedule a phone screen.",
      interested: "Send interview scheduling link and confirm availability.",
      interview_scheduled: "Send calendar reminder and prep materials.",
      closed: "Archive or re-engage in 90 days if appropriate.",
    };
    return NextResponse.json({
      suggestion: step ?? fallbacks[c.status as string] ?? "Review candidate profile and update status.",
      source: step ? "ai" : "template",
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
