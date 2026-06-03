import { NextRequest, NextResponse } from "next/server";
import { runSourcingEngine } from "@/lib/automation/sourcing-engine";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSourcingEngine();
  return NextResponse.json(result);
}
