import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken, requireAdmin } from "@/lib/auth/server";
import { COLLECTIONS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!requireAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, email, password, status, avatarUrl } = await request.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const userRecord = await getAdminAuth().createUser({
      email,
      password,
      displayName: name,
      ...(avatarUrl ? { photoURL: avatarUrl } : {}),
    });
    const db = getAdminDb();

    await db.collection(COLLECTIONS.users).doc(userRecord.uid).set({
      email,
      name,
      role: "recruiter",
      status: status ?? "active",
      ...(avatarUrl ? { avatarUrl } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection(COLLECTIONS.activities).add({
      userId: auth!.uid,
      userName: auth!.name,
      action: `Recruiter created: ${name}`,
      entityType: "user",
      entityId: userRecord.uid,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: userRecord.uid });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!requireAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id, name, status } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getAdminDb();
  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (name) updates.name = name;
  if (status) updates.status = status;

  await db.collection(COLLECTIONS.users).doc(id).update(updates);

  if (status) {
    await getAdminAuth().updateUser(id, { disabled: status === "inactive" });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!requireAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getAdminDb();

  const userSnap = await db.collection(COLLECTIONS.users).doc(id).get();
  const name = userSnap.data()?.name ?? "recruiter";

  const assigned = await db
    .collection(COLLECTIONS.candidates)
    .where("assignedRecruiterId", "==", id)
    .get();

  const batch = db.batch();
  assigned.forEach((doc) => {
    batch.update(doc.ref, {
      assignedRecruiterId: FieldValue.delete(),
      assignedRecruiterName: FieldValue.delete(),
    });
  });
  if (!assigned.empty) await batch.commit();

  await db.collection(COLLECTIONS.users).doc(id).delete();

  try {
    await getAdminAuth().deleteUser(id);
  } catch {
    // Auth user may already be gone; Firestore doc is the source of truth for the UI.
  }

  await db.collection(COLLECTIONS.activities).add({
    userId: auth!.uid,
    userName: auth!.name,
    action: `Recruiter removed: ${name}`,
    entityType: "user",
    entityId: id,
    timestamp: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true, unassigned: assigned.size });
}
