import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "./client";
import { COLLECTIONS } from "@/lib/constants";
import type { AppUser } from "@/types";

function toDate(value: unknown): Date {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date(value as string);
}

export async function signIn(email: string, password: string) {
  const auth = getClientAuth();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOut() {
  await firebaseSignOut(getClientAuth());
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const db = getClientDb();
  const snap = await getDoc(doc(db, COLLECTIONS.users, uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    id: snap.id,
    uid: snap.id,
    email: data.email,
    name: data.name,
    role: data.role,
    status: data.status,
    avatarUrl: data.avatarUrl,
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  };
}

export async function getIdToken(user: User): Promise<string> {
  return user.getIdToken();
}
