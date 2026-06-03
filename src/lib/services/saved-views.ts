import {
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { CandidateFilters, SavedView } from "@/types";

function mapSavedView(id: string, data: Record<string, unknown>): SavedView {
  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    filters: data.filters as CandidateFilters,
    createdAt: toDate(data.createdAt),
  };
}

export async function getSavedViews(userId: string): Promise<SavedView[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.savedViews),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapSavedView));
}

export async function createSavedView(params: {
  userId: string;
  name: string;
  filters: CandidateFilters;
}): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, COLLECTIONS.savedViews), {
    ...params,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteSavedView(id: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, COLLECTIONS.savedViews, id));
}
