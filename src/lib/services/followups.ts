import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  type DocumentData,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { Followup, FollowupStatus } from "@/types";

function mapFollowup(id: string, data: DocumentData): Followup {
  return {
    id,
    candidateId: data.candidateId,
    candidateName: data.candidateName,
    recruiterId: data.recruiterId,
    recruiterName: data.recruiterName,
    sequenceStep: data.sequenceStep,
    scheduledFor: toDate(data.scheduledFor),
    status: data.status,
    subject: data.subject,
    body: data.body,
    sentAt: data.sentAt ? toDate(data.sentAt) : undefined,
    createdAt: toDate(data.createdAt),
  };
}

export async function getFollowups(): Promise<Followup[]> {
  const db = getClientDb();
  const q = query(collection(db, COLLECTIONS.followups), orderBy("scheduledFor", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapFollowup));
}

export async function getFollowupsByCandidate(candidateId: string): Promise<Followup[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.followups),
    where("candidateId", "==", candidateId),
    orderBy("scheduledFor", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapFollowup));
}

export async function getFollowupsByRecruiter(recruiterId: string): Promise<Followup[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.followups),
    where("recruiterId", "==", recruiterId),
    orderBy("scheduledFor", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapFollowup));
}

export function filterFollowupsByStatus(
  followups: Followup[],
  status: FollowupStatus
): Followup[] {
  return followups.filter((f) => f.status === status);
}
