import type {
  ApolloSearchParams,
  ApolloSearchResult,
  ApolloPersonPreview,
  ApolloEnrichedPerson,
} from "@/types/apollo";
import { ApolloApiError } from "@/lib/apollo/errors";

/**
 * People Data Labs (PDL) provider — a free-tier-friendly alternative to Apollo
 * that returns full person profiles (email, phone, LinkedIn, employer, title).
 *
 * Enable by setting DATA_PROVIDER=pdl and PDL_API_KEY in .env.local.
 * Free dev tier: ~100 credits/month. Each returned search record costs 1 credit,
 * so we cache full records from search to avoid re-charging on enrich.
 */

const PDL_BASE = "https://api.peopledatalabs.com/v5";

/** Default profiles per search — each costs 1 PDL credit. Keep low on free tier. */
const PDL_DEFAULT_PAGE_SIZE = Math.min(
  Math.max(parseInt(process.env.PDL_SEARCH_SIZE ?? "5", 10) || 5, 1),
  100
);

export function isPdlConfigured(): boolean {
  return Boolean(process.env.PDL_API_KEY?.trim());
}

function getApiKey(): string {
  const key = process.env.PDL_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "PDL_API_KEY is not configured. Add it to .env.local and restart the dev server."
    );
  }
  return key;
}

interface PdlPerson {
  id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  job_title_sub_role?: string;
  job_company_name?: string;
  education?: { degrees?: string[]; majors?: string[] }[];
  emails?: { address?: string; type?: string }[];
  /** On free tier PDL returns `true` when a field exists but is masked. */
  work_email?: string | boolean | null;
  recommended_personal_email?: string | boolean | null;
  personal_emails?: string[] | boolean;
  phone_numbers?: string[];
  mobile_phone?: string | boolean | null;
  linkedin_url?: string;
  location_name?: string;
  location_locality?: string;
  location_region?: string;
  location_country?: string;
  experience?: {
    start_date?: string | null;
    end_date?: string | null;
  }[];
}

interface PdlSearchResponse {
  status: number;
  data?: PdlPerson[];
  total?: number;
  error?: { type?: string; message?: string };
}

interface PdlEnrichResponse {
  status: number;
  data?: PdlPerson;
  error?: { type?: string; message?: string };
}

/** Short-lived cache of full records pulled during search, keyed by PDL id. */
const recordCache = new Map<string, ApolloEnrichedPerson>();

function isMasked(value: unknown): boolean {
  return value === true;
}

function stringOrEmpty(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function pickEmail(p: PdlPerson): string {
  if (isMasked(p.work_email) || isMasked(p.recommended_personal_email)) return "";
  const work = stringOrEmpty(p.work_email);
  if (work.includes("@")) return work;
  const fromList = p.emails?.find((e) => e.address?.includes("@"))?.address;
  if (fromList) return fromList;
  const rec = stringOrEmpty(p.recommended_personal_email);
  if (rec.includes("@")) return rec;
  if (Array.isArray(p.personal_emails)) {
    const first = p.personal_emails.find(
      (e) => typeof e === "string" && e.includes("@")
    );
    if (typeof first === "string") return first;
  }
  return "";
}

function pickPhone(p: PdlPerson): string {
  if (isMasked(p.mobile_phone)) return "";
  const mobile = stringOrEmpty(p.mobile_phone);
  if (mobile) return mobile;
  const first = p.phone_numbers?.find((n) => typeof n === "string" && n.trim());
  return first ?? "";
}

function hasEmailField(p: PdlPerson): boolean {
  return (
    pickEmail(p).length > 0 ||
    isMasked(p.work_email) ||
    isMasked(p.recommended_personal_email) ||
    isMasked(p.personal_emails) ||
    Boolean(p.emails?.length)
  );
}

function hasPhoneField(p: PdlPerson): boolean {
  return (
    pickPhone(p).length > 0 ||
    isMasked(p.mobile_phone) ||
    Boolean(p.phone_numbers?.length)
  );
}

function computeExperience(p: PdlPerson): string {
  const starts = (p.experience ?? [])
    .map((e) =>
      typeof e?.start_date === "string"
        ? parseInt(e.start_date.slice(0, 4), 10)
        : NaN
    )
    .filter((y) => !Number.isNaN(y));
  if (!starts.length) return "Not specified";
  const years = new Date().getFullYear() - Math.min(...starts);
  return years > 0 ? `${years} years` : "Less than 1 year";
}

/** Common healthcare credentials to surface as license/certification. */
const HEALTHCARE_CREDENTIALS = [
  "RN", "LPN", "LVN", "CNA", "APRN", "NP", "FNP", "DNP", "CRNA", "CNM",
  "BSN", "MSN", "ADN", "PA", "PA-C", "MD", "DO", "MBBS", "RPh", "PharmD",
  "RT", "RRT", "CRT", "RCP", "RDCS", "RDMS", "ARRT", "RPSGT",
  "PT", "DPT", "PTA", "OT", "OTR", "COTA", "SLP", "CCC-SLP",
  "RDN", "RD", "LCSW", "LMSW", "MSW", "BCBA", "RBT",
  "EMT", "EMT-P", "NRP", "CMA", "RMA", "MA", "MLT", "MLS", "CPC",
];

const CREDENTIAL_REGEX = new RegExp(
  `\\b(${HEALTHCARE_CREDENTIALS.map((c) => c.replace(/-/g, "\\-")).join("|")})\\b`,
  "gi"
);

function extractCertification(p: PdlPerson): string | undefined {
  const found = new Set<string>();
  const scan = (text?: unknown) => {
    if (typeof text !== "string") return;
    const matches = text.toUpperCase().match(CREDENTIAL_REGEX);
    matches?.forEach((m) => found.add(m.toUpperCase()));
  };

  scan(p.job_title);
  scan(p.job_title_sub_role);
  for (const edu of p.education ?? []) {
    edu.degrees?.forEach(scan);
    edu.majors?.forEach(scan);
  }

  // Map common full role names to their credential when no abbreviation appears.
  if (!found.size && typeof p.job_title === "string") {
    const t = p.job_title.toLowerCase();
    if (t.includes("registered nurse")) found.add("RN");
    else if (t.includes("licensed practical nurse")) found.add("LPN");
    else if (t.includes("nurse practitioner")) found.add("NP");
    else if (t.includes("physician assistant")) found.add("PA");
    else if (t.includes("physical therapist")) found.add("PT");
    else if (t.includes("occupational therapist")) found.add("OT");
    else if (t.includes("certified nursing assistant")) found.add("CNA");
  }

  return found.size ? Array.from(found).join(", ") : undefined;
}

function toTitleCase(value?: unknown): string {
  // PDL free tier masks some fields by returning a boolean (true) instead of a
  // string, so guard against any non-string value before calling .split().
  if (typeof value !== "string" || !value) return "";
  return value
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function pdlId(p: PdlPerson): string {
  if (typeof p.id === "string" && p.id) return p.id;
  if (typeof p.linkedin_url === "string" && p.linkedin_url) return p.linkedin_url;
  if (typeof p.full_name === "string" && p.full_name) return p.full_name;
  return crypto.randomUUID();
}

function mapPdlToEnriched(p: PdlPerson): ApolloEnrichedPerson {
  const id = pdlId(p);
  const fullName =
    toTitleCase(p.full_name) ||
    [p.first_name, p.last_name].filter(Boolean).map(toTitleCase).join(" ") ||
    "Unknown";
  const city = toTitleCase(p.location_locality);
  const state = toTitleCase(p.location_region);
  const country = toTitleCase(p.location_country);
  const location =
    toTitleCase(p.location_name) ||
    [city, state, country].filter(Boolean).join(", ") ||
    "Unknown";

  return {
    apolloId: id,
    fullName,
    role: toTitleCase(p.job_title) || "Healthcare Professional",
    email: pickEmail(p),
    phone: pickPhone(p),
    location,
    city,
    state,
    linkedinUrl:
      typeof p.linkedin_url === "string" && p.linkedin_url
        ? p.linkedin_url.startsWith("http")
          ? p.linkedin_url
          : `https://${p.linkedin_url}`
        : undefined,
    experience: computeExperience(p),
    currentEmployer: toTitleCase(p.job_company_name),
    title: toTitleCase(p.job_title),
    organizationName: toTitleCase(p.job_company_name),
    certification: extractCertification(p),
    emailAvailable: hasEmailField(p),
    phoneAvailable: hasPhoneField(p),
  };
}

function mapPdlToPreview(p: PdlPerson): ApolloPersonPreview {
  const id = pdlId(p);
  const lastName = toTitleCase(p.last_name);
  return {
    id,
    firstName:
      toTitleCase(p.first_name) ||
      toTitleCase(
        typeof p.full_name === "string" ? p.full_name.split(" ")[0] : undefined
      ),
    lastNameObfuscated: lastName ? `${lastName[0]}.` : "",
    title: toTitleCase(p.job_title),
    organizationName: toTitleCase(p.job_company_name),
    hasEmail: hasEmailField(p),
    hasPhone: hasPhoneField(p),
    hasCity: Boolean(p.location_locality),
    hasState: Boolean(p.location_region),
  };
}

function parsePdlError(data: Record<string, unknown>, status: number): ApolloApiError {
  const errField = data.error;
  let message: string | undefined;
  let errorCode: string | undefined;
  if (typeof errField === "object" && errField !== null) {
    const e = errField as { message?: string | string[]; type?: string | string[] };
    const rawMsg = e.message;
    message = Array.isArray(rawMsg) ? rawMsg.join(", ") : rawMsg;
    const rawType = e.type;
    errorCode = Array.isArray(rawType) ? rawType[0] : rawType;
  }
  if (!message && typeof data.message === "string") message = data.message;
  return new ApolloApiError(
    message ?? `People Data Labs error (${status})`,
    status,
    errorCode
  );
}

function readCreditsRemaining(res: Response): number | undefined {
  const raw = res.headers.get("x-totallimit-remaining");
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

async function pdlFetch<T>(
  path: string,
  body: Record<string, unknown>
): Promise<{ data: T; creditsRemaining?: number }> {
  const res = await fetch(`${PDL_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": getApiKey(),
    },
    body: JSON.stringify(body),
  });

  const creditsRemaining = readCreditsRemaining(res);
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      if (!res.ok) {
        throw new ApolloApiError(text.trim() || `PDL error (${res.status})`, res.status);
      }
    }
  }

  if (!res.ok) {
    throw parsePdlError(data, res.status);
  }

  return { data: data as T, creditsRemaining };
}

/** Common country names a user might type into the city/state box. */
const KNOWN_COUNTRIES = new Set([
  "united states", "us", "usa", "united kingdom", "uk", "canada", "india",
  "australia", "germany", "france", "spain", "italy", "ireland", "mexico",
  "brazil", "philippines", "netherlands", "singapore", "new zealand",
  "united arab emirates", "uae", "saudi arabia", "south africa", "nigeria",
]);

function normalizeCountry(token: string): string {
  const map: Record<string, string> = {
    us: "united states",
    usa: "united states",
    uk: "united kingdom",
    uae: "united arab emirates",
  };
  return map[token] ?? token;
}

/** Build an Elasticsearch query from the generic search params. */
function buildQuery(params: ApolloSearchParams): Record<string, unknown> {
  const must: Record<string, unknown>[] = [];

  // Collect location tokens, separating any country names from region/locality.
  const locationTokens = new Set<string>();
  let country: string | null = null;
  for (const loc of params.personLocations ?? []) {
    for (const part of loc.split(",")) {
      const token = part.trim().toLowerCase();
      if (!token) continue;
      if (KNOWN_COUNTRIES.has(token)) {
        country = normalizeCountry(token);
      } else {
        locationTokens.add(token);
      }
    }
  }

  // Default to the US unless the user explicitly typed another country.
  const countryFilter =
    country ?? process.env.PDL_COUNTRY?.trim().toLowerCase() ?? "united states";
  must.push({ term: { location_country: countryFilter } });

  // PDL does not allow minimum_should_match — use nested bool.should (OR) inside must.
  if (params.personTitles?.length) {
    must.push({
      bool: {
        should: params.personTitles.map((t) => ({
          match: { job_title: t.toLowerCase() },
        })),
      },
    });
  }

  if (locationTokens.size) {
    const should: Record<string, unknown>[] = [];
    for (const token of locationTokens) {
      should.push({ term: { location_region: token } });
      should.push({ term: { location_locality: token } });
    }
    must.push({ bool: { should } });
  }

  if (params.organizationDomains?.length) {
    must.push({
      bool: {
        should: params.organizationDomains.map((d) => ({
          term: { job_company_website: d.toLowerCase() },
        })),
      },
    });
  }

  return { bool: { must } };
}

function mapPdlSearchResponse(
  data: PdlSearchResponse,
  page: number,
  perPage: number,
  creditsRemaining?: number,
  creditLimited?: boolean
): ApolloSearchResult {
  const records = data.data ?? [];
  const enriched: ApolloEnrichedPerson[] = [];
  const people: ApolloPersonPreview[] = records.map((p) => {
    const full = mapPdlToEnriched(p);
    recordCache.set(full.apolloId, full);
    enriched.push(full);
    return mapPdlToPreview(p);
  });

  return {
    people,
    totalEntries: data.total ?? people.length,
    page,
    perPage,
    enriched,
    provider: "pdl",
    creditsRemaining,
    creditLimited,
  };
}

export async function pdlSearch(
  params: ApolloSearchParams
): Promise<ApolloSearchResult> {
  const page = params.page ?? 1;
  // Hard cap every PDL search at PDL_DEFAULT_PAGE_SIZE (default 5) so no caller —
  // manual search or background auto-sourcing — can exhaust free-tier credits.
  const requested = Math.min(
    params.perPage ?? PDL_DEFAULT_PAGE_SIZE,
    PDL_DEFAULT_PAGE_SIZE
  );
  const trySizes = [...new Set([requested, 3, 1])]
    .filter((n) => n >= 1 && n <= requested)
    .sort((a, b) => b - a);

  let lastErr: unknown;
  for (const size of trySizes) {
    try {
      const { data, creditsRemaining } = await pdlFetch<PdlSearchResponse>(
        "/person/search",
        {
          query: buildQuery(params),
          size,
          pretty: false,
        }
      );
      return mapPdlSearchResponse(
        data,
        page,
        size,
        creditsRemaining,
        size < requested
      );
    } catch (err) {
      if (err instanceof ApolloApiError && err.status === 404) {
        return {
          people: [],
          totalEntries: 0,
          page,
          perPage: size,
          enriched: [],
          provider: "pdl",
        };
      }
      if (err instanceof ApolloApiError && err.status === 402) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new ApolloApiError(
        "People Data Labs search credits are used up for this month.",
        402,
        "payment_required"
      );
}

export async function pdlEnrich(ids: string[]): Promise<ApolloEnrichedPerson[]> {
  const results: ApolloEnrichedPerson[] = [];
  for (const id of ids) {
    const cached = recordCache.get(id);
    if (cached) {
      results.push(cached);
      continue;
    }
    // Cold cache (e.g. serverless restart) — enrich by PDL persistent id.
    try {
      const { data } = await pdlFetch<PdlEnrichResponse>("/person/enrich", {
        pdl_id: id,
      });
      if (data.data) {
        const enriched = mapPdlToEnriched(data.data);
        recordCache.set(id, enriched);
        results.push(enriched);
      }
    } catch {
      // Skip records that can't be re-fetched rather than failing the batch.
    }
  }
  return results;
}

async function pdlEnrichRequest(
  params: Record<string, unknown>
): Promise<ApolloEnrichedPerson | null> {
  try {
    const { data } = await pdlFetch<PdlEnrichResponse>("/person/enrich", {
      ...params,
      min_likelihood: 2,
    });
    return data.data ? mapPdlToEnriched(data.data) : null;
  } catch (err) {
    // 404 = no confident match; treat as "not found" rather than an error.
    if (err instanceof ApolloApiError && err.status === 404) return null;
    throw err;
  }
}

export async function pdlEnrichByLinkedIn(
  linkedinUrl: string
): Promise<ApolloEnrichedPerson | null> {
  return pdlEnrichRequest({ profile: linkedinUrl });
}

export async function pdlEnrichByEmail(
  email: string
): Promise<ApolloEnrichedPerson | null> {
  return pdlEnrichRequest({ email });
}

export async function pdlEnrichByName(
  name: string,
  company?: string,
  location?: string
): Promise<ApolloEnrichedPerson | null> {
  const params: Record<string, unknown> = { name };
  if (company) params.company = company;
  if (location) params.location = location;
  return pdlEnrichRequest(params);
}
