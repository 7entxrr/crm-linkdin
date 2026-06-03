import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/server";
import { COLLECTIONS } from "@/lib/constants";

/** GET — find duplicate groups by email */
export async function GET(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.candidates).get();
  const byEmail = new Map<string, { id: string; fullName: string; email: string }[]>();

  snap.docs.forEach((d) => {
    const email = (d.data().email as string)?.toLowerCase()?.trim();
    if (!email) return;
    const list = byEmail.get(email) ?? [];
    list.push({
      id: d.id,
      fullName: d.data().fullName as string,
      email,
    });
    byEmail.set(email, list);
  });

  const groups = Array.from(byEmail.entries())
    .filter(([, list]) => list.length > 1)
    .map(([email, candidates]) => ({ email, candidates }));

  return NextResponse.json({ groups, count: groups.length });
}

/** POST — merge keepId + mergeIds into keepId */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { keepId, mergeIds } = (await request.json()) as {
    keepId: string;
    mergeIds: string[];
  };

  if (!keepId || !mergeIds?.length) {
    return NextResponse.json({ error: "keepId and mergeIds required" }, { status: 400 });
  }

  const db = getAdminDb();
  const keepRef = db.collection(COLLECTIONS.candidates).doc(keepId);
  const keepSnap = await keepRef.get();
  if (!keepSnap.exists) {
    return NextResponse.json({ error: "Keep candidate not found" }, { status: 404 });
  }

  const batch = db.batch();
  for (const id of mergeIds) {
    if (id === keepId) continue;
    batch.delete(db.collection(COLLECTIONS.candidates).doc(id));
  }
  await batch.commit();

  await db.collection(COLLECTIONS.activities).add({
    userId: auth.uid,
    userName: auth.name,
    action: `Merged ${mergeIds.length} duplicate(s) into ${keepSnap.data()!.fullName}`,
    entityType: "candidate",
    entityId: keepId,
    timestamp: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, merged: mergeIds.length });
}
