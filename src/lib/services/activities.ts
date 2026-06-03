import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { Activity } from "@/types";

function mapActivity(id: string, data: DocumentData): Activity {
  return {
    id,
    userId: data.userId,
    userName: data.userName,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    meta: data.meta,
    timestamp: toDate(data.timestamp),
  };
}

export async function logActivity(params: {
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  meta?: Record<string, unknown>;
}) {
  const db = getClientDb();
  await addDoc(collection(db, COLLECTIONS.activities), {
    ...params,
    timestamp: serverTimestamp(),
  });
}

export async function getActivities(limitCount = 50): Promise<Activity[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.activities),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapActivity));
}

export async function getActivitiesByEntity(
  entityType: string,
  entityId: string
): Promise<Activity[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.activities),
    where("entityType", "==", entityType),
    where("entityId", "==", entityId),
    orderBy("timestamp", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapActivity));
}
