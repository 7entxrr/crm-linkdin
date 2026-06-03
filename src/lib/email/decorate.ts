import crypto from "crypto";
import { getBaseUrl } from "@/lib/app-url";

/** Signed token so unsubscribe / inbound links can't be trivially forged. */
export function signToken(value: string): string {
  const secret = process.env.CRON_SECRET || "nightingale-dev-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(value)
    .digest("hex")
    .slice(0, 24);
}

export function verifyToken(value: string, token: string): boolean {
  const expected = signToken(value);
  // constant-time compare
  if (expected.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

const PIXEL_HIDDEN = 'width="1" height="1" alt="" style="display:none;border:0"';

/**
 * Adds open-tracking pixel, click-tracking on links, and a CAN-SPAM
 * unsubscribe footer to an outgoing email body. The body may contain
 * plain-text newlines; the mailer converts them to <br>.
 */
export function decorateEmail(params: {
  html: string;
  outreachId: string;
  candidateId: string;
  companyName?: string;
}): string {
  const base = getBaseUrl();
  let html = params.html;

  // Wrap existing anchor hrefs for click tracking (skip mailto + unsubscribe).
  html = html.replace(/href="([^"]+)"/g, (match, url: string) => {
    if (url.startsWith("mailto:") || url.includes("/api/unsubscribe")) {
      return match;
    }
    const tracked = `${base}/api/track/click?o=${encodeURIComponent(
      params.outreachId
    )}&u=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });

  const token = signToken(params.candidateId);
  const unsubUrl = `${base}/api/unsubscribe?c=${encodeURIComponent(
    params.candidateId
  )}&t=${token}`;
  const company = params.companyName || "We";

  html +=
    `\n\n<hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0" />` +
    `<p style="font-size:12px;color:#9ca3af;line-height:1.5">` +
    `${company} sent you this message about a career opportunity. ` +
    `If you'd prefer not to hear from us, ` +
    `<a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline">unsubscribe</a>.` +
    `</p>`;

  // Open pixel last.
  html += `<img src="${base}/api/track/open?o=${encodeURIComponent(
    params.outreachId
  )}" ${PIXEL_HIDDEN} />`;

  return html;
}
