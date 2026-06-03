import { NextRequest, NextResponse } from "next/server";
import { runAutomationEngine } from "@/lib/automation/engine";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutomationEngine();
  return NextResponse.json(result);
}
