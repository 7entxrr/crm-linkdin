import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/server";
import { bulkEnrichPeople } from "@/lib/apollo/client";
import { apolloErrorResponse } from "@/lib/apollo/errors";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { apolloIds } = (await request.json()) as { apolloIds: string[] };

    if (!apolloIds?.length) {
      return NextResponse.json({ error: "apolloIds required" }, { status: 400 });
    }

    if (apolloIds.length > 10) {
      return NextResponse.json(
        { error: "Maximum 10 IDs per request" },
        { status: 400 }
      );
    }

    const people = await bulkEnrichPeople(apolloIds);
    return NextResponse.json({ people });
  } catch (err) {
    const { body, status } = apolloErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
