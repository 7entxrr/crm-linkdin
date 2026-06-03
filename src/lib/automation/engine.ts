import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, SEQUENCE_STEPS } from "@/lib/constants";
import { createTransport } from "@/lib/email/mailer";
import { decorateEmail } from "@/lib/email/decorate";
import { isWithinSendWindow } from "@/lib/automation/settings-server";
import {
  renderTemplate,
  getTemplateVariablesFromCandidate,
} from "@/lib/email/template";
import { createNotification } from "@/lib/notifications/server";
import { DEFAULT_AUTOMATION, type AppSettings, type Candidate, type SequenceStep } from "@/types";

interface RunResult {
  processed: number;
  sent: number;
  stopped: number;
  failed: number;
  skipped: number;
  errors: string[];
}

function toCandidate(id: string, data: FirebaseFirestore.DocumentData): Candidate {
  const toDate = (v: unknown) =>
    v instanceof Timestamp ? v.toDate() : new Date(v as string);
  return {
    id,
    fullName: data.fullName,
    role: data.role,
    email: data.email,
    phone: data.phone,
    location: data.location,
    city: data.city,
    state: data.state,
    linkedinUrl: data.linkedinUrl,
    experience: data.experience,
    currentEmployer: data.currentEmployer,
    certification: data.certification,
    status: data.status,
    assignedRecruiterId: data.assignedRecruiterId,
    assignedRecruiterName: data.assignedRecruiterName,
    tags: data.tags ?? [],
    optedOut: data.optedOut ?? false,
    emailBounced: data.emailBounced ?? false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function enrollCandidateInSequence(params: {
  candidateId: string;
  candidateName: string;
  recruiterId: string;
  recruiterName: string;
  startDate?: Date;
}) {
  const db = getAdminDb();
  const start = params.startDate ?? new Date();

  for (const step of SEQUENCE_STEPS) {
    const scheduledFor = new Date(start);
    scheduledFor.setDate(scheduledFor.getDate() + step.day);

    await db.collection(COLLECTIONS.followups).add({
      candidateId: params.candidateId,
      candidateName: params.candidateName,
      recruiterId: params.recruiterId,
      recruiterName: params.recruiterName,
      sequenceStep: step.step,
      scheduledFor: Timestamp.fromDate(scheduledFor),
      status: "scheduled",
      subject: step.defaultSubject,
      body: `Hi {{firstName}},\n\nWe have an exciting {{role}} opportunity in {{location}}.\n\nBest,\nNightingale Recruit`,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function stopSequenceForCandidate(candidateId: string) {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTIONS.followups)
    .where("candidateId", "==", candidateId)
    .where("status", "==", "scheduled")
    .get();

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "stopped" });
  });
  await batch.commit();
}

export async function runAutomationEngine(): Promise<RunResult> {
  const db = getAdminDb();
  const result: RunResult = {
    processed: 0,
    sent: 0,
    stopped: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const settingsSnap = await db.collection(COLLECTIONS.settings).doc("app").get();
  const settings = settingsSnap.data() as AppSettings | undefined;
  if (!settings?.smtp?.host) {
    result.errors.push("SMTP not configured in settings");
    return result;
  }

  const automation = { ...DEFAULT_AUTOMATION, ...(settings.automation ?? {}) };
  const companyName = settings.companyName;

  // Respect the configured send window — defer this run if outside it.
  if (!isWithinSendWindow(automation)) {
    result.errors.push("Outside configured send window — skipping run");
    return result;
  }

  // Daily cap: how many more emails may we send right now?
  let remaining = Infinity;
  if (automation.dailyCap > 0) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sentTodaySnap = await db
      .collection(COLLECTIONS.outreachs)
      .where("sentAt", ">=", Timestamp.fromDate(startOfDay))
      .count()
      .get();
    remaining = Math.max(automation.dailyCap - sentTodaySnap.data().count, 0);
  }

  const now = Timestamp.now();
  const dueSnap = await db
    .collection(COLLECTIONS.followups)
    .where("status", "==", "scheduled")
    .where("scheduledFor", "<=", now)
    .get();

  const transport = createTransport(settings.smtp);

  for (const followupDoc of dueSnap.docs) {
    if (remaining <= 0) {
      result.errors.push("Daily send cap reached — remaining follow-ups deferred");
      break;
    }
    result.processed++;
    const followup = followupDoc.data();

    const candidateSnap = await db
      .collection(COLLECTIONS.candidates)
      .doc(followup.candidateId)
      .get();

    if (!candidateSnap.exists) {
      await followupDoc.ref.update({ status: "skipped" });
      continue;
    }

    const candidate = toCandidate(candidateSnap.id, candidateSnap.data()!);

    // Stop on reply, opt-out, or bounce.
    if (candidate.status === "replied" || candidate.optedOut) {
      await stopSequenceForCandidate(candidate.id);
      result.stopped++;
      continue;
    }
    if (candidate.emailBounced || !candidate.email) {
      await followupDoc.ref.update({ status: "skipped" });
      result.skipped++;
      continue;
    }

    const vars = getTemplateVariablesFromCandidate(candidate);
    const subject = renderTemplate(followup.subject ?? "Follow-up", vars);
    const body = renderTemplate(
      followup.body ?? "Hi {{firstName}}, following up on our {{role}} opportunity.",
      vars
    );

    // Create the outreach record first so we have an id for open/click tracking.
    const outreachRef = db.collection(COLLECTIONS.outreachs).doc();
    const decorated = decorateEmail({
      html: body,
      outreachId: outreachRef.id,
      candidateId: candidate.id,
      companyName,
    });

    try {
      await transport.sendMail({
        from: settings.fromEmail,
        to: candidate.email,
        subject,
        html: decorated.replace(/\n/g, "<br>"),
      });

      await followupDoc.ref.update({
        status: "sent",
        sentAt: FieldValue.serverTimestamp(),
      });

      await outreachRef.set({
        candidateId: candidate.id,
        candidateName: candidate.fullName,
        recruiterId: followup.recruiterId,
        recruiterName: followup.recruiterName,
        subject,
        body,
        channel: "email",
        status: "sent",
        opens: 0,
        clicks: 0,
        sentAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });

      await db.collection(COLLECTIONS.activities).add({
        userId: followup.recruiterId,
        userName: followup.recruiterName ?? "System",
        action: `Follow-up sent (${followup.sequenceStep})`,
        entityType: "candidate",
        entityId: candidate.id,
        timestamp: FieldValue.serverTimestamp(),
      });

      if (candidate.status === "new_lead") {
        await candidateSnap.ref.update({
          status: "contacted",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (followup.recruiterId) {
        await createNotification({
          userId: followup.recruiterId,
          type: "followup_sent",
          title: `Follow-up sent to ${candidate.fullName}`,
          body: `${followup.sequenceStep.replace("_", " ")} email delivered.`,
          entityType: "candidate",
          entityId: candidate.id,
        });
      }

      result.sent++;
      remaining--;
    } catch (err) {
      result.failed++;
      result.errors.push(
        `Failed for ${candidate.fullName}: ${err instanceof Error ? err.message : "Unknown"}`
      );
      await followupDoc.ref.update({ status: "skipped" });
    }
  }

  return result;
}

export function getSequenceStepLabel(step: SequenceStep): string {
  return SEQUENCE_STEPS.find((s) => s.step === step)?.label ?? step;
}
