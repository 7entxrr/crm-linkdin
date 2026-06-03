/**
 * Absolute base URL for building links embedded in outgoing emails
 * (tracking pixel, click redirects, unsubscribe). Set NEXT_PUBLIC_APP_URL
 * in production; falls back to localhost in development.
 */
export function getBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}
