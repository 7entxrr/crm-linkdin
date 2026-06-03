import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { verifyAuthToken } from "@/lib/auth/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import {
  enrichPersonByApolloId,
  enrichPersonByEmail,
  enrichPersonByLinkedIn,
} from "@/lib/apollo/client";
import { enrichedToCandidateFields } from "@/lib/apollo/mapper";
import { apolloErrorResponse } from "@/lib/apollo/errors";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { candidateId } = (await request.json()) as { candidateId: string };

    if (!candidateId) {
      return NextResponse.json({ error: "candidateId required" }, { status: 400 });
    }

    const db = getAdminDb();
    const snap = await db.collection(COLLECTIONS.candidates).doc(candidateId).get();

    if (!snap.exists) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const data = snap.data()!;

    let enriched = null;
    if (data.apolloId) {
      enriched = await enrichPersonByApolloId(data.apolloId);
    } else if (data.linkedinUrl) {
      enriched = await enrichPersonByLinkedIn(data.linkedinUrl);
    } else if (data.email) {
      enriched = await enrichPersonByEmail(data.email);
    } else {
      return NextResponse.json(
        { error: "Candidate needs Apollo ID, LinkedIn URL, or email to enrich" },
        { status: 400 }
      );
    }

    if (!enriched) {
      return NextResponse.json(
        { error: "No matching profile found in Apollo" },
        { status: 404 }
      );
    }

    const fields = enrichedToCandidateFields(
      enriched,
      data.assignedRecruiterId,
      data.assignedRecruiterName
    );

    await snap.ref.update({
      ...fields,
      apolloLastEnrichedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await db.collection(COLLECTIONS.activities).add({
      userId: auth.uid,
      userName: auth.name,
      action: `Enriched from Apollo: ${enriched.fullName}`,
      entityType: "candidate",
      entityId: candidateId,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, enriched });
  } catch (err) {
    const { body, status } = apolloErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
