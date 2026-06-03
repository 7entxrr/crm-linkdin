export class ApolloApiError extends Error {
  readonly status: number;
  readonly errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = "ApolloApiError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

export function isApolloPlanError(err: unknown): boolean {
  return (
    err instanceof ApolloApiError &&
    (err.status === 403 || err.errorCode === "API_INACCESSIBLE")
  );
}

export function isPdlQuotaError(err: unknown): boolean {
  if (!(err instanceof ApolloApiError)) return false;
  if (err.status === 402) return true;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("account maximum") ||
    msg.includes("all matches used") ||
    err.errorCode === "payment_required"
  );
}

export function apolloErrorResponse(err: unknown) {
  if (err instanceof ApolloApiError) {
    const quotaExceeded = isPdlQuotaError(err);
    return {
      body: {
        error: quotaExceeded
          ? "People Data Labs search credits are used up for this month. Each profile returned costs 1 credit (~100/month on the free plan). Check usage at peopledatalabs.com or wait for your monthly reset."
          : err.message,
        errorCode: err.errorCode,
        upgradeRequired: isApolloPlanError(err),
        quotaExceeded,
      },
      status: err.status,
    };
  }

  const message = err instanceof Error ? err.message : "Apollo request failed";
  const missingKey = message.includes("APOLLO_API_KEY");
  return {
    body: { error: message, upgradeRequired: false },
    status: missingKey ? 503 : 500,
  };
}
