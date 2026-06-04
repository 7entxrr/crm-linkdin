import { getClientAuth } from "@/lib/firebase/client";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const auth = getClientAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  let token = await user.getIdToken();
  let res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  // The cached ID token can be stale (e.g. a long-lived/backgrounded tab). On a
  // 401, force-refresh the token once and retry before surfacing an error.
  if (res.status === 401) {
    token = await user.getIdToken(true);
    res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (data as { error?: string }).error ?? "Request failed"
    ) as Error & {
      upgradeRequired?: boolean;
      quotaExceeded?: boolean;
      status?: number;
    };
    err.upgradeRequired = (data as { upgradeRequired?: boolean }).upgradeRequired;
    err.quotaExceeded = (data as { quotaExceeded?: boolean }).quotaExceeded;
    err.status = res.status;
    throw err;
  }
  return data;
}
