import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import { verifyToken } from "@/lib/email/decorate";
import { stopSequenceForCandidate } from "@/lib/automation/engine";

function page(title: string, message: string, ok: boolean) {
  const accent = ok ? "#0d9488" : "#dc2626";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"/>` +
      `<meta name="viewport" content="width=device-width, initial-scale=1"/>` +
      `<title>${title}</title></head>` +
      `<body style="font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;margin:0;padding:48px 16px;color:#0f172a">` +
      `<div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center">` +
      `<div style="width:48px;height:48px;border-radius:9999px;background:${accent};margin:0 auto 16px"></div>` +
      `<h1 style="font-size:20px;margin:0 0 8px">${title}</h1>` +
      `<p style="color:#64748b;font-size:14px;line-height:1.6;margin:0">${message}</p>` +
      `</div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const candidateId = params.get("c");
  const token = params.get("t");

  if (!candidateId || !token || !verifyToken(candidateId, token)) {
    return page(
      "Invalid link",
      "This unsubscribe link is invalid or has expired.",
      false
    );
  }

  try {
    const db = getAdminDb();
    const ref = db.collection(COLLECTIONS.candidates).doc(candidateId);
    const snap = await ref.get();
    if (!snap.exists) {
      return page("Already removed", "You're not on our mailing list.", true);
    }

    await ref.update({
      optedOut: true,
      optedOutAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await stopSequenceForCandidate(candidateId);

    await db.collection(COLLECTIONS.activities).add({
      userId: "system",
      userName: "System",
      action: "Candidate unsubscribed",
      entityType: "candidate",
      entityId: candidateId,
      timestamp: FieldValue.serverTimestamp(),
    });

    return page(
      "You're unsubscribed",
      "You won't receive any more emails from us. Thanks for letting us know.",
      true
    );
  } catch {
    return page(
      "Something went wrong",
      "We couldn't process your request. Please try again later.",
      false
    );
  }
}
