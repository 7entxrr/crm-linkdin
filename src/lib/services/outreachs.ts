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
import type { Outreach } from "@/types";

function mapOutreach(id: string, data: DocumentData): Outreach {
  return {
    id,
    candidateId: data.candidateId,
    candidateName: data.candidateName,
    recruiterId: data.recruiterId,
    recruiterName: data.recruiterName,
    templateId: data.templateId,
    subject: data.subject,
    body: data.body,
    channel: data.channel ?? "email",
    status: data.status,
    sentAt: data.sentAt ? toDate(data.sentAt) : undefined,
    opens: data.opens ?? 0,
    clicks: data.clicks ?? 0,
    openedAt: data.openedAt ? toDate(data.openedAt) : undefined,
    firstClickAt: data.firstClickAt ? toDate(data.firstClickAt) : undefined,
    repliedAt: data.repliedAt ? toDate(data.repliedAt) : undefined,
    createdAt: toDate(data.createdAt),
  };
}

export async function getOutreachs(): Promise<Outreach[]> {
  const db = getClientDb();
  const q = query(collection(db, COLLECTIONS.outreachs), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapOutreach));
}

export async function getOutreachsByCandidate(candidateId: string): Promise<Outreach[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.outreachs),
    where("candidateId", "==", candidateId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapOutreach));
}
