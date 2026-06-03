import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { EmailTemplate } from "@/types";

function mapTemplate(id: string, data: DocumentData): EmailTemplate {
  return {
    id,
    name: data.name,
    subject: data.subject,
    body: data.body,
    createdBy: data.createdBy,
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  };
}

export async function getTemplates(): Promise<EmailTemplate[]> {
  const db = getClientDb();
  const q = query(collection(db, COLLECTIONS.templates), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapTemplate));
}

export async function getTemplate(id: string): Promise<EmailTemplate | null> {
  const db = getClientDb();
  const snap = await getDoc(doc(db, COLLECTIONS.templates, id));
  if (!snap.exists()) return null;
  return mapTemplate(snap.id, snap.data());
}

export async function createTemplate(data: {
  name: string;
  subject: string;
  body: string;
  createdBy: string;
}): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, COLLECTIONS.templates), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTemplate(
  id: string,
  data: Partial<Pick<EmailTemplate, "name" | "subject" | "body">>
): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, COLLECTIONS.templates, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, COLLECTIONS.templates, id));
}
