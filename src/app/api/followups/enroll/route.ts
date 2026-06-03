import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/server";
import { enrollCandidateInSequence } from "@/lib/automation/engine";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidateId } = await request.json();
  if (!candidateId) {
    return NextResponse.json({ error: "candidateId required" }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.candidates).doc(candidateId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const candidate = snap.data()!;

  await enrollCandidateInSequence({
    candidateId,
    candidateName: candidate.fullName,
    recruiterId: auth.uid,
    recruiterName: auth.name,
  });

  await db.collection(COLLECTIONS.activities).add({
    userId: auth.uid,
    userName: auth.name,
    action: "Enrolled in follow-up sequence",
    entityType: "candidate",
    entityId: candidateId,
    timestamp: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
