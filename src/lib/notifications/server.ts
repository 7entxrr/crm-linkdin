import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import type { NotificationType } from "@/types";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}) {
  const db = getAdminDb();
  await db.collection(COLLECTIONS.notifications).add({
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
