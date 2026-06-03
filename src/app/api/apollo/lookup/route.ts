import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth/server";
import {
  enrichPersonByEmail,
  enrichPersonByLinkedIn,
  enrichPersonByName,
} from "@/lib/apollo/client";
import { apolloErrorResponse } from "@/lib/apollo/errors";

type LookupBody = {
  linkedinUrl?: string;
  email?: string;
  name?: string;
  company?: string;
  location?: string;
};

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as LookupBody;
    const linkedinUrl = body.linkedinUrl?.trim();
    const email = body.email?.trim();
    const name = body.name?.trim();

    let person = null;
    if (linkedinUrl) {
      person = await enrichPersonByLinkedIn(linkedinUrl);
    } else if (email) {
      person = await enrichPersonByEmail(email);
    } else if (name) {
      person = await enrichPersonByName(
        name,
        body.company?.trim() || undefined,
        body.location?.trim() || undefined
      );
    } else {
      return NextResponse.json(
        { error: "Provide a LinkedIn URL, email, or name to look up." },
        { status: 400 }
      );
    }

    if (!person) {
      return NextResponse.json(
        { error: "No matching profile found. Try a LinkedIn URL or a more specific name + company." },
        { status: 404 }
      );
    }

    return NextResponse.json({ person });
  } catch (err) {
    const { body, status } = apolloErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
