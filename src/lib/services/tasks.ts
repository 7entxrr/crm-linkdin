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
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { Task, TaskStatus } from "@/types";

function mapTask(id: string, data: Record<string, unknown>): Task {
  return {
    id,
    userId: data.userId as string,
    userName: data.userName as string,
    title: data.title as string,
    description: data.description as string | undefined,
    candidateId: data.candidateId as string | undefined,
    candidateName: data.candidateName as string | undefined,
    dueAt: toDate(data.dueAt),
    status: data.status as TaskStatus,
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
  };
}

export async function getTasksForUser(userId: string): Promise<Task[]> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.tasks),
    where("userId", "==", userId),
    orderBy("dueAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapTask));
}

export async function getTasksDueToday(userId: string): Promise<Task[]> {
  const tasks = await getTasksForUser(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.dueAt >= today &&
      t.dueAt < tomorrow
  );
}

export async function createTask(params: {
  userId: string;
  userName: string;
  title: string;
  description?: string;
  candidateId?: string;
  candidateName?: string;
  dueAt: Date;
}): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(collection(db, COLLECTIONS.tasks), {
    ...params,
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, COLLECTIONS.tasks, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTask(id: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, COLLECTIONS.tasks, id));
}
