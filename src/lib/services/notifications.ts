import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore } from "@/lib/firebase/converters";
import type { Notification } from "@/types";

function mapNotification(id: string, data: Record<string, unknown>): Notification {
  return {
    id,
    userId: data.userId as string,
    type: data.type as Notification["type"],
    title: data.title as string,
    body: data.body as string,
    entityType: data.entityType as string | undefined,
    entityId: data.entityId as string | undefined,
    read: (data.read as boolean) ?? false,
    createdAt: toDate(data.createdAt),
  };
}

export function subscribeNotifications(
  userId: string,
  isAdmin: boolean,
  onData: (notifications: Notification[]) => void
): Unsubscribe {
  const db = getClientDb();
  const q = isAdmin
    ? query(collection(db, COLLECTIONS.notifications), orderBy("createdAt", "desc"))
    : query(
        collection(db, COLLECTIONS.notifications),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) =>
      fromFirestore(d, (id, data) => mapNotification(id, data))
    );
    onData(items.slice(0, 50));
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  const db = getClientDb();
  await updateDoc(doc(db, COLLECTIONS.notifications, id), { read: true });
}

export async function markAllNotificationsRead(
  notifications: Notification[]
): Promise<void> {
  const db = getClientDb();
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => {
    batch.update(doc(db, COLLECTIONS.notifications, n.id), { read: true });
  });
  await batch.commit();
}

export async function getNotifications(userId: string, isAdmin: boolean): Promise<Notification[]> {
  const db = getClientDb();
  const q = isAdmin
    ? query(collection(db, COLLECTIONS.notifications), orderBy("createdAt", "desc"))
    : query(
        collection(db, COLLECTIONS.notifications),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );
  const snap = await getDocs(q);
  return snap.docs.map((d) => fromFirestore(d, mapNotification)).slice(0, 50);
}
