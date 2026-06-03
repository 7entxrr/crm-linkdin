import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

function pixelResponse() {
  return new NextResponse(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    },
  });
}

export async function GET(request: NextRequest) {
  const outreachId = request.nextUrl.searchParams.get("o");
  if (outreachId) {
    try {
      const db = getAdminDb();
      const ref = db.collection(COLLECTIONS.outreachs).doc(outreachId);
      const snap = await ref.get();
      if (snap.exists) {
        const data = snap.data()!;
        await ref.update({
          opens: FieldValue.increment(1),
          ...(data.openedAt ? {} : { openedAt: FieldValue.serverTimestamp() }),
        });
      }
    } catch {
      // Never fail the pixel.
    }
  }
  return pixelResponse();
}
