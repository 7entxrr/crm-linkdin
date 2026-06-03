import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken } from "@/lib/auth/server";
import { COLLECTIONS, SETTINGS_DOC_ID } from "@/lib/constants";
import { sendEmail } from "@/lib/email/mailer";

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const to = (body.to as string | undefined)?.trim() || auth.email;

  if (!to || !/.+@.+\..+/.test(to)) {
    return NextResponse.json(
      { error: "A valid recipient email is required" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const settingsSnap = await db
    .collection(COLLECTIONS.settings)
    .doc(SETTINGS_DOC_ID)
    .get();
  const settings = settingsSnap.data();

  if (!settings?.smtp?.host || !settings?.smtp?.user) {
    return NextResponse.json(
      { error: "SMTP is not configured. Ask an admin to set it up in Settings." },
      { status: 400 }
    );
  }

  const companyName = settings.companyName ?? "Nightingale Recruit";
  const sentAt = new Date().toLocaleString();

  try {
    await sendEmail({
      smtp: settings.smtp,
      from: settings.fromEmail,
      to,
      subject: `Test email from ${companyName}`,
      html:
        `Hi ${auth.name},\n\n` +
        `This is a test email confirming that your SMTP configuration is working.\n\n` +
        `Sent by: ${auth.name} (${auth.email})\n` +
        `Time: ${sentAt}\n\n` +
        `If you received this, outreach emails will send correctly.`,
    });

    return NextResponse.json({ success: true, to });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Send failed: ${err.message}`
            : "Send failed. Check your SMTP settings.",
      },
      { status: 500 }
    );
  }
}
