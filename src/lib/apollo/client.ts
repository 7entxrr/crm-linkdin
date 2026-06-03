import type {
  ApolloSearchParams,
  ApolloSearchResult,
  ApolloPersonPreview,
  ApolloEnrichedPerson,
} from "@/types/apollo";
import { ApolloApiError } from "@/lib/apollo/errors";
import {
  isSandbox,
  sandboxSearch,
  sandboxEnrich,
  sandboxEnrichByMatch,
} from "@/lib/apollo/sandbox";
import {
  isPdlConfigured,
  pdlSearch,
  pdlEnrich,
  pdlEnrichByEmail,
  pdlEnrichByLinkedIn,
  pdlEnrichByName,
} from "@/lib/apollo/pdl";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

export type DataProvider = "sandbox" | "pdl" | "apollo";

/**
 * Resolve which data provider to use:
 * - APOLLO_SANDBOX=true always wins (offline sample data).
 * - DATA_PROVIDER explicitly selects "pdl" or "apollo".
 * - Otherwise auto-detect: prefer PDL if its key is set and Apollo's isn't.
 */
export function getActiveProvider(): DataProvider {
  const explicit = process.env.DATA_PROVIDER?.trim().toLowerCase();
  // Explicit provider wins over sandbox so DATA_PROVIDER=pdl + PDL_API_KEY uses live PDL.
  if (explicit === "pdl" && isPdlConfigured()) return "pdl";
  if (explicit === "apollo" && isApolloConfigured()) return "apollo";
  if (isSandbox()) return "sandbox";
  if (explicit === "pdl") return "pdl";
  if (explicit === "apollo") return "apollo";
  if (isPdlConfigured() && !process.env.APOLLO_API_KEY?.trim()) return "pdl";
  return "apollo";
}

function getApiKey(): string {
  const key = process.env.APOLLO_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "APOLLO_API_KEY is not configured. Add it to .env.local and restart the dev server."
    );
  }
  return key;
}

async function apolloFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, string | string[]> } = {}
): Promise<T> {
  const url = new URL(`${APOLLO_BASE}${path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(`${key}[]`, v));
      } else if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      accept: "application/json",
      "X-Api-Key": getApiKey(),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        throw new ApolloApiError(text.trim() || `Apollo API error (${res.status})`, res.status);
      }
    }
  }

  if (!res.ok) {
    const message =
      (typeof data.message === "string" ? data.message : undefined) ??
      (typeof data.error === "string" ? data.error : undefined) ??
      `Apollo API error (${res.status})`;
    const errorCode =
      typeof data.error_code === "string" ? data.error_code : undefined;
    throw new ApolloApiError(message, res.status, errorCode);
  }

  return data as T;
}

export function isApolloConfigured(): boolean {
  return Boolean(process.env.APOLLO_API_KEY?.trim());
}

interface ApolloSearchPersonRaw {
  id: string;
  first_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  has_email?: boolean;
  has_direct_phone?: string | boolean;
  has_city?: boolean;
  has_state?: boolean;
  last_refreshed_at?: string;
  organization?: { name?: string };
}

interface ApolloSearchResponse {
  people?: ApolloSearchPersonRaw[];
  total_entries?: number;
  pagination?: { page?: number; per_page?: number };
}

export async function searchPeople(
  params: ApolloSearchParams
): Promise<ApolloSearchResult> {
  const provider = getActiveProvider();
  if (provider === "sandbox") {
    return sandboxSearch(params);
  }
  if (provider === "pdl") {
    return pdlSearch(params);
  }

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 25;

  const query: Record<string, string | string[]> = {
    page: String(page),
    per_page: String(perPage),
    include_similar_titles: "true",
  };

  if (params.personTitles?.length) {
    query.person_titles = params.personTitles;
  }
  if (params.personLocations?.length) {
    query.person_locations = params.personLocations;
  }
  if (params.personSeniorities?.length) {
    query.person_seniorities = params.personSeniorities;
  }
  if (params.organizationDomains?.length) {
    query.q_organization_domains_list = params.organizationDomains;
  }

  const data = await apolloFetch<ApolloSearchResponse>(
    "/mixed_people/api_search",
    { method: "POST", query }
  );

  const people: ApolloPersonPreview[] = (data.people ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name ?? "",
    lastNameObfuscated: p.last_name_obfuscated ?? "",
    title: p.title,
    organizationName: p.organization?.name,
    hasEmail: !!p.has_email,
    hasPhone:
      p.has_direct_phone === true ||
      p.has_direct_phone === "Yes" ||
      (typeof p.has_direct_phone === "string" &&
        p.has_direct_phone.toLowerCase().includes("yes")),
    hasCity: !!p.has_city,
    hasState: !!p.has_state,
    lastRefreshedAt: p.last_refreshed_at,
  }));

  return {
    people,
    totalEntries: data.total_entries ?? people.length,
    page: data.pagination?.page ?? page,
    perPage: data.pagination?.per_page ?? perPage,
  };
}

interface ApolloPersonRaw {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  email?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  phone_numbers?: { raw_number?: string; sanitized_number?: string }[];
  organization?: { name?: string };
  employment_history?: { start_date?: string; end_date?: string | null }[];
}

interface BulkMatchResponse {
  matches?: ApolloPersonRaw[];
  people?: ApolloPersonRaw[];
}

export async function bulkEnrichPeople(
  apolloIds: string[]
): Promise<ApolloEnrichedPerson[]> {
  if (apolloIds.length === 0) return [];
  const provider = getActiveProvider();
  if (provider === "sandbox") {
    return sandboxEnrich(apolloIds);
  }
  if (provider === "pdl") {
    return pdlEnrich(apolloIds);
  }
  if (apolloIds.length > 10) {
    throw new Error("Maximum 10 Apollo IDs per enrich request");
  }

  const data = await apolloFetch<BulkMatchResponse>("/people/bulk_match", {
    method: "POST",
    query: {
      reveal_personal_emails: "false",
      reveal_phone_number: "false",
    },
    body: {
      details: apolloIds.map((id) => ({ id })),
    },
  });

  const matches = data.matches ?? data.people ?? [];
  const { mapApolloPersonToEnriched } = await import("./mapper");
  return matches
    .filter((p) => p.id)
    .map((p) => mapApolloPersonToEnriched(p as ApolloPersonRaw & { id: string }));
}

export async function enrichPersonByLinkedIn(
  linkedinUrl: string
): Promise<ApolloEnrichedPerson | null> {
  const provider = getActiveProvider();
  if (provider === "sandbox") {
    return sandboxEnrichByMatch((p) => p.linkedin === linkedinUrl);
  }
  if (provider === "pdl") {
    return pdlEnrichByLinkedIn(linkedinUrl);
  }
  const data = await apolloFetch<{ person?: ApolloPersonRaw }>("/people/match", {
    method: "POST",
    query: {
      reveal_personal_emails: "false",
      reveal_phone_number: "false",
    },
    body: { linkedin_url: linkedinUrl },
  });

  if (!data.person?.id) return null;
  const { mapApolloPersonToEnriched } = await import("./mapper");
  return mapApolloPersonToEnriched(data.person as ApolloPersonRaw & { id: string });
}

export async function enrichPersonByEmail(
  email: string
): Promise<ApolloEnrichedPerson | null> {
  const provider = getActiveProvider();
  if (provider === "sandbox") {
    return sandboxEnrichByMatch((p) => p.email === email);
  }
  if (provider === "pdl") {
    return pdlEnrichByEmail(email);
  }
  const data = await apolloFetch<{ person?: ApolloPersonRaw }>("/people/match", {
    method: "POST",
    query: {
      reveal_personal_emails: "false",
      reveal_phone_number: "false",
    },
    body: { email },
  });

  if (!data.person?.id) return null;
  const { mapApolloPersonToEnriched } = await import("./mapper");
  return mapApolloPersonToEnriched(data.person as ApolloPersonRaw & { id: string });
}

export async function enrichPersonByApolloId(
  apolloId: string
): Promise<ApolloEnrichedPerson | null> {
  const results = await bulkEnrichPeople([apolloId]);
  return results[0] ?? null;
}

export async function enrichPersonByName(
  name: string,
  company?: string,
  location?: string
): Promise<ApolloEnrichedPerson | null> {
  const provider = getActiveProvider();
  if (provider === "sandbox") {
    const q = name.toLowerCase();
    return sandboxEnrichByMatch((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
  }
  if (provider === "pdl") {
    return pdlEnrichByName(name, company, location);
  }
  const data = await apolloFetch<{ person?: ApolloPersonRaw }>("/people/match", {
    method: "POST",
    query: {
      reveal_personal_emails: "false",
      reveal_phone_number: "false",
    },
    body: { name, organization_name: company },
  });
  if (!data.person?.id) return null;
  const { mapApolloPersonToEnriched } = await import("./mapper");
  return mapApolloPersonToEnriched(data.person as ApolloPersonRaw & { id: string });
}
