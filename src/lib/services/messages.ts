import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { Message } from "@/types";

function mapMessage(id: string, data: Record<string, unknown>): Message {
  return {
    id,
    candidateId: data.candidateId as string,
    direction: data.direction as Message["direction"],
    subject: data.subject as string | undefined,
    body: data.body as string,
    fromEmail: data.fromEmail as string | undefined,
    toEmail: data.toEmail as string | undefined,
    outreachId: data.outreachId as string | undefined,
    createdAt: toDate(data.createdAt),
  };
}

export async function getMessagesByCandidate(candidateId: string): Promise<Message[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.messages),
    where("candidateId", "==", candidateId),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapMessage));
}
