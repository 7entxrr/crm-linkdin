import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { searchPeople, bulkEnrichPeople } from "@/lib/apollo/client";
import { importApolloPeopleToFirestore } from "@/lib/apollo/import-server";
import { enrollCandidateInSequence } from "@/lib/automation/engine";
import type { ApolloEnrichedPerson } from "@/types/apollo";

interface SourcingRuleData {
  name: string;
  personTitles: string[];
  locations: string[];
  organizationDomains?: string[];
  perRun: number;
  enabled: boolean;
  autoEnroll: boolean;
  assignedRecruiterId?: string;
  assignedRecruiterName?: string;
}

export interface SourcingRunResult {
  rulesProcessed: number;
  searched: number;
  imported: number;
  skipped: number;
  enrolled: number;
  errors: string[];
  perRule: {
    ruleId: string;
    name: string;
    imported: number;
    skipped: number;
  }[];
}

const ENRICH_BATCH = 10;

async function runRule(
  ruleId: string,
  rule: SourcingRuleData,
  result: SourcingRunResult
) {
  const db = getAdminDb();
  // Cap how many records we pull per run; Apollo per_page max is 100.
  const perRun = Math.min(Math.max(rule.perRun || 10, 1), 50);

  const search = await searchPeople({
    personTitles: rule.personTitles,
    personLocations: rule.locations.length ? rule.locations : undefined,
    organizationDomains: rule.organizationDomains?.length
      ? rule.organizationDomains
      : undefined,
    page: 1,
    perPage: perRun,
  });

  result.searched += search.people.length;

  const ids = search.people.map((p) => p.id).slice(0, perRun);
  const enriched: ApolloEnrichedPerson[] = [];
  for (let i = 0; i < ids.length; i += ENRICH_BATCH) {
    const chunk = ids.slice(i, i + ENRICH_BATCH);
    const people = await bulkEnrichPeople(chunk);
    enriched.push(...people);
  }

  const importResult = await importApolloPeopleToFirestore({
    people: enriched,
    recruiterId: rule.assignedRecruiterId,
    recruiterName: rule.assignedRecruiterName,
    userId: "system",
    userName: "Auto-Sourcing",
    extraTags: ["auto-sourced"],
  });

  result.imported += importResult.imported;
  result.skipped += importResult.skipped;
  result.perRule.push({
    ruleId,
    name: rule.name,
    imported: importResult.imported,
    skipped: importResult.skipped,
  });

  if (rule.autoEnroll && rule.assignedRecruiterId && importResult.candidateIds.length) {
    for (let i = 0; i < importResult.candidateIds.length; i++) {
      const candidateId = importResult.candidateIds[i];
      const person = enriched[i];
      if (!person) continue;
      await enrollCandidateInSequence({
        candidateId,
        candidateName: person.fullName,
        recruiterId: rule.assignedRecruiterId,
        recruiterName: rule.assignedRecruiterName ?? "Recruiter",
      });
      result.enrolled++;
    }
  }

  await db.collection(COLLECTIONS.sourcingRules).doc(ruleId).update({
    lastRunAt: FieldValue.serverTimestamp(),
    lastRunImported: importResult.imported,
    totalImported: FieldValue.increment(importResult.imported),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db.collection(COLLECTIONS.activities).add({
    userId: "system",
    userName: "Auto-Sourcing",
    action: `Sourcing rule "${rule.name}" imported ${importResult.imported}, skipped ${importResult.skipped}`,
    entityType: "sourcing",
    entityId: ruleId,
    timestamp: FieldValue.serverTimestamp(),
  });
}

export async function runSourcingEngine(
  ruleId?: string
): Promise<SourcingRunResult> {
  const db = getAdminDb();
  const result: SourcingRunResult = {
    rulesProcessed: 0,
    searched: 0,
    imported: 0,
    skipped: 0,
    enrolled: 0,
    errors: [],
    perRule: [],
  };

  let rules: { id: string; data: SourcingRuleData }[] = [];

  if (ruleId) {
    const snap = await db.collection(COLLECTIONS.sourcingRules).doc(ruleId).get();
    if (snap.exists) {
      rules = [{ id: snap.id, data: snap.data() as SourcingRuleData }];
    }
  } else {
    const snap = await db
      .collection(COLLECTIONS.sourcingRules)
      .where("enabled", "==", true)
      .get();
    rules = snap.docs.map((d) => ({ id: d.id, data: d.data() as SourcingRuleData }));
  }

  for (const { id, data } of rules) {
    result.rulesProcessed++;
    try {
      await runRule(id, data, result);
    } catch (err) {
      result.errors.push(
        `Rule "${data.name}": ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return result;
}

export function timestampToDate(v: unknown): Date | undefined {
  if (v instanceof Timestamp) return v.toDate();
  return undefined;
}
