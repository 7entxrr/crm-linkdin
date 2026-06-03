import type {
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";

export function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as Timestamp).toDate();
  }
  return new Date(value as string);
}

export function fromFirestore<T>(
  snap: QueryDocumentSnapshot<DocumentData>,
  mapper: (id: string, data: DocumentData) => T
): T {
  return mapper(snap.id, snap.data());
}

/** Firestore rejects `undefined` field values — omit them before writes. */
export function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
