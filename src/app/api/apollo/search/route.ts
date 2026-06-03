import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/server";
import { searchPeople, getActiveProvider } from "@/lib/apollo/client";
import { apolloErrorResponse } from "@/lib/apollo/errors";
import type { ApolloSearchParams } from "@/types/apollo";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as ApolloSearchParams;
    const result = await searchPeople(body);
    return NextResponse.json({
      ...result,
      provider: result.provider ?? getActiveProvider(),
    });
  } catch (err) {
    const { body, status } = apolloErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
