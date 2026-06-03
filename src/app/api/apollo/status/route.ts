import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/server";
import { isApolloConfigured, getActiveProvider } from "@/lib/apollo/client";
import { isPdlConfigured } from "@/lib/apollo/pdl";
import { isSandbox } from "@/lib/apollo/sandbox";

export async function GET(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const provider = getActiveProvider();

  if (provider === "sandbox") {
    return NextResponse.json({
      configured: true,
      accessible: true,
      sandbox: true,
      provider: "sandbox",
      message:
        "Sandbox mode is ON — searches return sample data (no credits used). Set APOLLO_SANDBOX=false for live data.",
    });
  }

  if (provider === "pdl") {
    if (!isPdlConfigured()) {
      return NextResponse.json({
        configured: false,
        provider: "pdl",
        message:
          "PDL_API_KEY is missing. Add it to .env.local and restart npm run dev.",
      });
    }
    return NextResponse.json({
      configured: true,
      accessible: true,
      provider: "pdl",
      message:
        "People Data Labs is active. Free tier credits apply — each returned record uses 1 credit.",
    });
  }

  if (!isApolloConfigured()) {
    return NextResponse.json({
      configured: false,
      message:
        "APOLLO_API_KEY is missing. Add it to .env.local and restart npm run dev.",
    });
  }

  try {
    const key = process.env.APOLLO_API_KEY!.trim();
    const url = new URL("https://api.apollo.io/api/v1/mixed_people/api_search");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "1");
    url.searchParams.append("person_titles[]", "Registered Nurse");

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        accept: "application/json",
        "X-Api-Key": key,
      },
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = { error: text.trim() };
      }
    }

    if (res.ok) {
      return NextResponse.json({
        configured: true,
        accessible: true,
        provider: "apollo",
        message: "Apollo People Search API is ready.",
      });
    }

    const message =
      (typeof data.error === "string" ? data.error : undefined) ??
      (typeof data.message === "string" ? data.message : undefined) ??
      `Apollo returned ${res.status}`;
    const errorCode =
      typeof data.error_code === "string" ? data.error_code : undefined;
    const upgradeRequired =
      res.status === 403 || errorCode === "API_INACCESSIBLE";

    return NextResponse.json({
      configured: true,
      accessible: false,
      upgradeRequired,
      errorCode,
      message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Apollo status check failed";
    return NextResponse.json({
      configured: true,
      accessible: false,
      message,
    });
  }
}
