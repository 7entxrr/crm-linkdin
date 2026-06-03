import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { FieldValue } from "firebase-admin/firestore";

/**
 * SMS outreach via Twilio. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidateId, body } = await request.json();
  if (!candidateId || !body) {
    return NextResponse.json({ error: "candidateId and body required" }, { status: 400 });
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return NextResponse.json(
      { error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER." },
      { status: 503 }
    );
  }

  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.candidates).doc(candidateId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const candidate = snap.data()!;
  if (!candidate.phone) {
    return NextResponse.json({ error: "Candidate has no phone number" }, { status: 400 });
  }
  if (candidate.optedOut) {
    return NextResponse.json({ error: "Candidate has opted out" }, { status: 409 });
  }

  const phone = candidate.phone.replace(/\D/g, "");
  const to = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;

  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err || "Twilio send failed" }, { status: 500 });
  }

  await db.collection(COLLECTIONS.outreachs).add({
    candidateId,
    candidateName: candidate.fullName,
    recruiterId: auth.uid,
    recruiterName: auth.name,
    subject: "SMS",
    body,
    channel: "sms",
    status: "sent",
    sentAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ success: true });
}
