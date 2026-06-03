import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const outreachId = params.get("o");
  const target = params.get("u");

  if (outreachId) {
    try {
      const db = getAdminDb();
      const ref = db.collection(COLLECTIONS.outreachs).doc(outreachId);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data()!;
        await ref.update({
          clicks: FieldValue.increment(1),
          ...(data.firstClickAt
            ? {}
            : { firstClickAt: FieldValue.serverTimestamp() }),
        });
      }
    } catch {
      // Don't block the redirect on tracking failures.
    }
  }

  // Only redirect to safe absolute http(s) URLs.
  if (target && /^https?:\/\//i.test(target)) {
    return NextResponse.redirect(target, 302);
  }
  return NextResponse.json({ ok: true });
}
