export interface ApolloSearchParams {
  personTitles?: string[];
  personLocations?: string[];
  personSeniorities?: string[];
  organizationDomains?: string[];
  page?: number;
  perPage?: number;
}

export interface ApolloPersonPreview {
  id: string;
  firstName: string;
  lastNameObfuscated: string;
  title?: string;
  organizationName?: string;
  hasEmail: boolean;
  hasPhone: boolean;
  hasCity: boolean;
  hasState: boolean;
  lastRefreshedAt?: string;
}

export interface ApolloSearchResult {
  people: ApolloPersonPreview[];
  totalEntries: number;
  page: number;
  perPage: number;
  /** PDL search includes full profiles from the same request (no separate enrich credits). */
  enriched?: ApolloEnrichedPerson[];
  provider?: "sandbox" | "pdl" | "apollo";
  /** PDL free-tier credits left after this search (from API response headers). */
  creditsRemaining?: number;
  /** True when page size was reduced to fit remaining PDL credits. */
  creditLimited?: boolean;
}

export interface ApolloEnrichedPerson {
  apolloId: string;
  fullName: string;
  role: string;
  email: string;
  phone: string;
  location: string;
  city: string;
  state: string;
  linkedinUrl?: string;
  experience: string;
  currentEmployer: string;
  title?: string;
  organizationName?: string;
  /** License/certification (e.g. RN, BSN, NP) derived from title + education. */
  certification?: string;
  /** True when the provider has an email on file (may be masked on free tier). */
  emailAvailable?: boolean;
  /** True when the provider has a phone on file (may be masked on free tier). */
  phoneAvailable?: boolean;
}

export interface ApolloImportPayload {
  people: ApolloEnrichedPerson[];
}

export interface ApolloImportResult {
  imported: number;
  skipped: number;
  skippedReasons: { apolloId: string; reason: string }[];
  candidateIds: string[];
}
