import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/constants";
import { toDate, fromFirestore, stripUndefined } from "@/lib/firebase/converters";
import type { Candidate, CandidateFilters, CandidateStatus } from "@/types";

function mapCandidate(id: string, data: DocumentData): Candidate {
  return {
    id,
    fullName: data.fullName,
    role: data.role,
    email: data.email,
    phone: data.phone,
    location: data.location,
    city: data.city,
    state: data.state,
    linkedinUrl: data.linkedinUrl,
    experience: data.experience,
    currentEmployer: data.currentEmployer,
    certification: data.certification,
    emailAvailable: data.emailAvailable ?? false,
    phoneAvailable: data.phoneAvailable ?? false,
    status: data.status,
    assignedRecruiterId: data.assignedRecruiterId,
    assignedRecruiterName: data.assignedRecruiterName,
    tags: data.tags ?? [],
    apolloId: data.apolloId,
    apolloLastEnrichedAt: data.apolloLastEnrichedAt
      ? toDate(data.apolloLastEnrichedAt)
      : undefined,
    source: data.source ?? "manual",
    optedOut: data.optedOut ?? false,
    optedOutAt: data.optedOutAt ? toDate(data.optedOutAt) : undefined,
    emailBounced: data.emailBounced ?? false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getCandidates(
  filters?: CandidateFilters,
  recruiterId?: string
): Promise<Candidate[]> {
  const db = getClientDb();
  let q = query(collection(db, COLLECTIONS.candidates), orderBy("createdAt", "desc"));

  if (recruiterId) {
    q = query(
      collection(db, COLLECTIONS.candidates),
      where("assignedRecruiterId", "==", recruiterId),
      orderBy("createdAt", "desc")
    );
  }

  const snap = await getDocs(q);
  let results = snap.docs.map((d) => fromFirestore(d, mapCandidate));

  if (filters?.status) {
    results = results.filter((c) => c.status === filters.status);
  }
  if (filters?.role) {
    results = results.filter((c) =>
      c.role.toLowerCase().includes(filters.role!.toLowerCase())
    );
  }
  if (filters?.state) {
    results = results.filter((c) => c.state === filters.state);
  }
  if (filters?.city) {
    results = results.filter((c) =>
      c.city.toLowerCase().includes(filters.city!.toLowerCase())
    );
  }
  if (filters?.experience) {
    results = results.filter((c) => c.experience === filters.experience);
  }
  if (filters?.recruiterId) {
    results = results.filter((c) => c.assignedRecruiterId === filters.recruiterId);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    results = results.filter(
      (c) =>
        c.fullName.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.phone.includes(s) ||
        c.currentEmployer.toLowerCase().includes(s)
    );
  }
  if (filters?.dateFrom) {
    results = results.filter((c) => c.createdAt >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    results = results.filter((c) => c.createdAt <= filters.dateTo!);
  }

  return results;
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const db = getClientDb();
  const snap = await getDoc(doc(db, COLLECTIONS.candidates, id));
  if (!snap.exists()) return null;
  return mapCandidate(snap.id, snap.data());
}

export async function createCandidate(
  data: Omit<Candidate, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const db = getClientDb();
  const ref = await addDoc(
    collection(db, COLLECTIONS.candidates),
    stripUndefined({
      ...data,
      tags: data.tags ?? [],
      source: data.source ?? "manual",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function updateCandidate(
  id: string,
  data: Partial<Candidate>
): Promise<void> {
  const db = getClientDb();
  const { id: _omitId, createdAt: _omitCreated, ...rest } = data;
  void _omitId;
  void _omitCreated;
  await updateDoc(
    doc(db, COLLECTIONS.candidates, id),
    stripUndefined({
      ...rest,
      updatedAt: serverTimestamp(),
    })
  );
}

export async function deleteCandidate(id: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, COLLECTIONS.candidates, id));
}

export async function bulkUpdateCandidates(
  ids: string[],
  data: Partial<Candidate>
): Promise<void> {
  const db = getClientDb();
  const batch = writeBatch(db);
  ids.forEach((id) => {
    batch.update(
      doc(db, COLLECTIONS.candidates, id),
      stripUndefined({
        ...data,
        updatedAt: serverTimestamp(),
      })
    );
  });
  await batch.commit();
}

export async function bulkDeleteCandidates(ids: string[]): Promise<void> {
  const db = getClientDb();
  const batch = writeBatch(db);
  ids.forEach((id) => batch.delete(doc(db, COLLECTIONS.candidates, id)));
  await batch.commit();
}

export async function findDuplicateByApolloId(
  apolloId: string
): Promise<Candidate | null> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.candidates),
    where("apolloId", "==", apolloId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return fromFirestore(snap.docs[0]!, mapCandidate);
}

export async function findDuplicateByEmail(
  email: string
): Promise<Candidate | null> {
  const db = getClientDb();
  const q = query(
    collection(db, COLLECTIONS.candidates),
    where("email", "==", email.toLowerCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return fromFirestore(snap.docs[0]!, mapCandidate);
}

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus
): Promise<void> {
  await updateCandidate(id, { status });
}
