import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/server";
import { importApolloPeopleToFirestore } from "@/lib/apollo/import-server";
import type { ApolloEnrichedPerson } from "@/types/apollo";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { people } = (await request.json()) as { people: ApolloEnrichedPerson[] };

    if (!people?.length) {
      return NextResponse.json({ error: "people array required" }, { status: 400 });
    }

    const result = await importApolloPeopleToFirestore({
      people,
      recruiterId: auth.uid,
      recruiterName: auth.name,
      userId: auth.uid,
      userName: auth.name,
      applyAutomation: true,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    );
  }
}
