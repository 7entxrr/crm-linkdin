import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  type DocumentData,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { AppUser } from "@/types";

function mapUser(id: string, data: DocumentData): AppUser {
  return {
    id,
    uid: id,
    email: data.email,
    name: data.name,
    role: data.role,
    status: data.status,
    avatarUrl: data.avatarUrl,
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  };
}

export async function getUsers(): Promise<AppUser[]> {
  const db = getClientDb();
  const q = query(collection(db, COLLECTIONS.users), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapUser));
}

export async function getRecruiters(): Promise<AppUser[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.users),
    where("role", "==", "recruiter"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapUser));
}

export async function getUser(id: string): Promise<AppUser | null> {
  const db = getClientDb();
  const snap = await getDoc(doc(db, COLLECTIONS.users, id));
  if (!snap.exists()) return null;
  return mapUser(snap.id, snap.data());
}
