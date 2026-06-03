import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type DocumentData,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { Note } from "@/types";

function mapNote(id: string, data: DocumentData): Note {
  return {
    id,
    candidateId: data.candidateId,
    authorId: data.authorId,
    authorName: data.authorName,
    body: data.body,
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  };
}

export async function getNotesByCandidate(candidateId: string): Promise<Note[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.notes),
    where("candidateId", "==", candidateId),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapNote));
}

export async function getAllNotes(recruiterId?: string): Promise<Note[]> {
  const db = getClientDb();
  let q = query(collection(db, COLLECTIONS.notes), orderBy("createdAt", "desc"));
  if (recruiterId) {
    q = query(
      collection(db, COLLECTIONS.notes),
      where("authorId", "==", recruiterId),
      orderBy("createdAt", "desc")
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapNote));
}

export async function createNote(data: {
  candidateId: string;
  authorId: string;
  authorName: string;
  body: string;
}): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, COLLECTIONS.notes), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNote(id: string, body: string): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, COLLECTIONS.notes, id), {
    body,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(id: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, COLLECTIONS.notes, id));
}
