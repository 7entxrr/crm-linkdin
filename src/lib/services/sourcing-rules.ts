import {
  collection,
  getDocs,
  query,
  orderBy,
  type DocumentData,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { SourcingRule } from "@/types";

function mapRule(id: string, data: DocumentData): SourcingRule {
  return {
    id,
    name: data.name,
    personTitles: data.personTitles ?? [],
    locations: data.locations ?? [],
    organizationDomains: data.organizationDomains ?? [],
    perRun: data.perRun ?? 10,
    enabled: data.enabled ?? true,
    autoEnroll: data.autoEnroll ?? false,
    assignedRecruiterId: data.assignedRecruiterId ?? undefined,
    assignedRecruiterName: data.assignedRecruiterName ?? undefined,
    lastRunAt: data.lastRunAt ? toDate(data.lastRunAt) : undefined,
    lastRunImported: data.lastRunImported,
    totalImported: data.totalImported ?? 0,
    createdBy: data.createdBy,
    createdAt: data.createdAt ? toDate(data.createdAt) : new Date(),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  };
}

export async function getSourcingRules(): Promise<SourcingRule[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.sourcingRules),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapRule));
}
