import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { enrichedToCandidateFields } from "./mapper";
import { getServerSettings } from "@/lib/automation/settings-server";
import { pickRecruiterRoundRobin } from "@/lib/automation/assignment";
import { enrollCandidateInSequence } from "@/lib/automation/engine";
import { createNotification } from "@/lib/notifications/server";
import type { ApolloEnrichedPerson, ApolloImportResult } from "@/types/apollo";

function buildAutoTags(
  person: ApolloEnrichedPerson,
  baseTags: string[] = [],
  extra: string[] = []
): string[] {
  const tags = new Set<string>([...baseTags, ...extra]);
  if (person.role) tags.add(person.role);
  if (person.certification) {
    person.certification.split(",").forEach((c) => {
      const t = c.trim();
      if (t) tags.add(t);
    });
  }
  if (person.state) tags.add(person.state);
  return Array.from(tags);
}

export async function importApolloPeopleToFirestore(params: {
  people: ApolloEnrichedPerson[];
  recruiterId?: string;
  recruiterName?: string;
  userId: string;
  userName: string;
  extraTags?: string[];
  /** When true, applies global automation settings (auto-assign + auto-enroll). */
  applyAutomation?: boolean;
}): Promise<ApolloImportResult> {
  const db = getAdminDb();
  const result: ApolloImportResult = {
    imported: 0,
    skipped: 0,
    skippedReasons: [],
    candidateIds: [],
  };

  const automation = params.applyAutomation
    ? (await getServerSettings()).automation
    : null;
  const pendingCounts: Record<string, number> = {};

  for (const person of params.people) {
    const apolloSnap = await db
      .collection(COLLECTIONS.candidates)
      .where("apolloId", "==", person.apolloId)
      .limit(1)
      .get();

    if (!apolloSnap.empty) {
      result.skipped++;
      result.skippedReasons.push({
        apolloId: person.apolloId,
        reason: "Already imported (Apollo ID)",
      });
      continue;
    }

    if (person.email) {
      const emailSnap = await db
        .collection(COLLECTIONS.candidates)
        .where("email", "==", person.email.toLowerCase())
        .limit(1)
        .get();

      if (!emailSnap.empty) {
        result.skipped++;
        result.skippedReasons.push({
          apolloId: person.apolloId,
          reason: "Duplicate email in CRM",
        });
        continue;
      }
    }

    let recruiterId = params.recruiterId;
    let recruiterName = params.recruiterName;

    // Auto-assign via round-robin when enabled (overrides the default importer).
    if (automation?.autoAssign) {
      const picked = await pickRecruiterRoundRobin(pendingCounts);
      if (picked) {
        recruiterId = picked.id;
        recruiterName = picked.name;
        pendingCounts[picked.id] = (pendingCounts[picked.id] ?? 0) + 1;
      }
    }

    const fields = enrichedToCandidateFields(person, recruiterId, recruiterName);
    fields.tags = buildAutoTags(person, fields.tags, params.extraTags);
    const providerLabel = fields.source === "pdl" ? "People Data Labs" : "Apollo";

    const ref = await db.collection(COLLECTIONS.candidates).add({
      ...fields,
      apolloLastEnrichedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    result.imported++;
    result.candidateIds.push(ref.id);

    // Auto-enroll into the follow-up sequence when enabled.
    if (
      automation?.autoEnrollOnImport &&
      recruiterId &&
      person.email
    ) {
      await enrollCandidateInSequence({
        candidateId: ref.id,
        candidateName: person.fullName,
        recruiterId,
        recruiterName: recruiterName ?? "Recruiter",
      });
    }

    await db.collection(COLLECTIONS.activities).add({
      userId: params.userId,
      userName: params.userName,
      action: `Imported from ${providerLabel}: ${person.fullName}`,
      entityType: "candidate",
      entityId: ref.id,
      meta: { apolloId: person.apolloId },
      timestamp: FieldValue.serverTimestamp(),
    });

    if (recruiterId && automation?.autoAssign) {
      await createNotification({
        userId: recruiterId,
        type: "candidate_assigned",
        title: `New candidate: ${person.fullName}`,
        body: `${person.role} · ${person.state || "—"} assigned to you.`,
        entityType: "candidate",
        entityId: ref.id,
      });
    }
  }

  return result;
}
