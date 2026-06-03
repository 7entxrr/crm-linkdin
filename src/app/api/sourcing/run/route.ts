import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, requireAdmin } from "@/lib/auth/server";
import { runSourcingEngine } from "@/lib/automation/sourcing-engine";
import { apolloErrorResponse } from "@/lib/apollo/errors";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!requireAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { ruleId } = (await request.json().catch(() => ({}))) as {
      ruleId?: string;
    };
    const result = await runSourcingEngine(ruleId);
    return NextResponse.json(result);
  } catch (err) {
    const { body, status } = apolloErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
