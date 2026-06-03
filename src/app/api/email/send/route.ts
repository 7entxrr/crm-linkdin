import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/server";
import { COLLECTIONS } from "@/lib/constants";
import { sendEmail } from "@/lib/email/mailer";
import { decorateEmail } from "@/lib/email/decorate";
import {
  renderTemplate,
  getTemplateVariablesFromCandidate,
} from "@/lib/email/template";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { candidateId, templateId, subject, body: emailBody } = body;

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }

  const db = getAdminDb();
  const candidateSnap = await db.collection(COLLECTIONS.candidates).doc(candidateId).get();
  if (!candidateSnap.exists) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const candidate = candidateSnap.data()!;

  if (candidate.optedOut) {
    return NextResponse.json(
      { error: "Candidate has unsubscribed and cannot be emailed" },
      { status: 409 }
    );
  }

  const settingsSnap = await db.collection(COLLECTIONS.settings).doc("app").get();
  const settings = settingsSnap.data();

  if (!settings?.smtp?.host) {
    return NextResponse.json({ error: "SMTP not configured" }, { status: 400 });
  }

  let finalSubject = subject ?? "Healthcare Opportunity";
  let finalBody = emailBody ?? "";

  if (templateId) {
    const templateSnap = await db.collection(COLLECTIONS.templates).doc(templateId).get();
    if (templateSnap.exists) {
      const t = templateSnap.data()!;
      finalSubject = t.subject;
      finalBody = t.body;
    }
  }

  const vars = getTemplateVariablesFromCandidate({
    fullName: candidate.fullName,
    role: candidate.role,
    location: candidate.location,
    currentEmployer: candidate.currentEmployer,
  });

  finalSubject = renderTemplate(finalSubject, vars);
  finalBody = renderTemplate(finalBody, vars);

  // Create outreach record first so we have an id for open/click tracking.
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
      templateId: templateId ?? null,
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
      action: "Email sent",
      entityType: "candidate",
      entityId: candidateId,
      timestamp: FieldValue.serverTimestamp(),
    });

    if (candidate.status === "new_lead") {
      await candidateSnap.ref.update({
        status: "contacted",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
