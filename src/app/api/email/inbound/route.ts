import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { stopSequenceForCandidate } from "@/lib/automation/engine";
import { createNotification } from "@/lib/notifications/server";

/**
 * Inbound email webhook. Point your email provider's inbound parse
 * (SendGrid / Mailgun / Postmark / etc.) at:
 *   POST /api/email/inbound?secret=YOUR_INBOUND_SECRET
 * When a candidate replies, their sequence is stopped and they are marked
 * as "replied" automatically.
 */

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

function extractEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(EMAIL_RE);
  return match ? match[0].toLowerCase() : null;
}

async function parsePayload(
  request: NextRequest
): Promise<{ from: string | null; subject: string | null; body: string | null }> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    const from =
      extractEmail(body.from) ||
      extractEmail(body.sender) ||
      extractEmail(body.From) ||
      extractEmail(body?.FromFull?.Email) ||
      extractEmail(body?.envelope?.from);
    const text =
      body.text ?? body.TextBody ?? body.stripped_text ?? body.html ?? body.HtmlBody ?? null;
    return {
      from,
      subject: body.subject ?? body.Subject ?? null,
      body: typeof text === "string" ? text.slice(0, 10000) : null,
    };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return { from: null, subject: null, body: null };
  const from =
    extractEmail(form.get("from")) ||
    extractEmail(form.get("sender")) ||
    extractEmail(form.get("From"));
  const subject = (form.get("subject") || form.get("Subject")) as string | null;
  const text = (form.get("text") || form.get("stripped-text") || form.get("body-plain")) as
    | string
    | null;
  return { from, subject, body: text?.slice(0, 10000) ?? null };
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.INBOUND_SECRET || process.env.CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { from, subject, body: replyBody } = await parsePayload(request);
  if (!from) {
    return NextResponse.json({ error: "No sender email found" }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTIONS.candidates)
    .where("email", "==", from)
    .limit(1)
    .get();

  if (snap.empty) {
    // Unknown sender — acknowledge so the provider doesn't retry.
    return NextResponse.json({ matched: false });
  }

  const candidateDoc = snap.docs[0];
  const candidate = candidateDoc.data();

  await candidateDoc.ref.update({
    status: "replied",
    updatedAt: FieldValue.serverTimestamp(),
  });

  await stopSequenceForCandidate(candidateDoc.id);

  // Mark the most recent outreach for this candidate as replied.
  const lastOutreach = await db
    .collection(COLLECTIONS.outreachs)
    .where("candidateId", "==", candidateDoc.id)
    .where("status", "==", "sent")
    .limit(10)
    .get();
  if (!lastOutreach.empty) {
    const sorted = lastOutreach.docs.sort((a, b) => {
      const ta = a.data().sentAt?.toMillis?.() ?? 0;
      const tb = b.data().sentAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    await sorted[0].ref.update({
      status: "replied",
      repliedAt: FieldValue.serverTimestamp(),
    });
  }

  await db.collection(COLLECTIONS.activities).add({
    userId: candidate.assignedRecruiterId || "system",
    userName: candidate.assignedRecruiterName || "System",
    action: `Reply received from ${candidate.fullName}`,
    entityType: "candidate",
    entityId: candidateDoc.id,
    meta: { subject: subject ?? null },
    timestamp: FieldValue.serverTimestamp(),
  });

  await db.collection(COLLECTIONS.messages).add({
    candidateId: candidateDoc.id,
    direction: "inbound",
    subject: subject ?? undefined,
    body: replyBody ?? "(No message body)",
    fromEmail: from,
    createdAt: FieldValue.serverTimestamp(),
  });

  if (candidate.assignedRecruiterId) {
    await createNotification({
      userId: candidate.assignedRecruiterId,
      type: "reply_received",
      title: `${candidate.fullName} replied`,
      body: subject ? `Subject: ${subject}` : "New reply received — sequence stopped.",
      entityType: "candidate",
      entityId: candidateDoc.id,
    });
  }

  return NextResponse.json({ matched: true, candidateId: candidateDoc.id });
}
