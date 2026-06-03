import type { ApolloEnrichedPerson } from "@/types/apollo";
import type { CandidateSource } from "@/types";
import { isSandbox } from "./sandbox";
import { isPdlConfigured } from "./pdl";

function resolveImportSource(): CandidateSource {
  if (isSandbox()) return "apollo";
  const explicit = process.env.DATA_PROVIDER?.trim().toLowerCase();
  if (explicit === "pdl" || (isPdlConfigured() && explicit !== "apollo")) return "pdl";
  return "apollo";
}

interface ApolloPersonRaw {
  id: string;
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

function computeExperienceYears(
  history?: { start_date?: string; end_date?: string | null }[]
): string {
  if (!history?.length) return "Not specified";
  const starts = history
    .map((h) => (h.start_date ? new Date(h.start_date).getFullYear() : null))
    .filter((y): y is number => y !== null);
  if (!starts.length) return "Not specified";
  const earliest = Math.min(...starts);
  const years = new Date().getFullYear() - earliest;
  return years > 0 ? `${years} years` : "Less than 1 year";
}

export function mapApolloPersonToEnriched(
  person: ApolloPersonRaw
): ApolloEnrichedPerson {
  const fullName =
    person.name?.trim() ||
    [person.first_name, person.last_name].filter(Boolean).join(" ").trim() ||
    "Unknown";

  const city = person.city ?? "";
  const state = person.state ?? "";
  const country = person.country ?? "";
  const location = [city, state, country].filter(Boolean).join(", ") || "Unknown";

  const phone =
    person.phone_numbers?.[0]?.sanitized_number ??
    person.phone_numbers?.[0]?.raw_number ??
    "";

  return {
    apolloId: person.id,
    fullName,
    role: person.title ?? "Healthcare Professional",
    email: person.email ?? "",
    phone,
    location,
    city,
    state,
    linkedinUrl: person.linkedin_url,
    experience: computeExperienceYears(person.employment_history),
    currentEmployer: person.organization?.name ?? "",
    title: person.title,
    organizationName: person.organization?.name,
    emailAvailable: Boolean(person.email),
    phoneAvailable: Boolean(phone),
  };
}

export function enrichedToCandidateFields(
  enriched: ApolloEnrichedPerson,
  recruiterId?: string,
  recruiterName?: string
) {
  const source = resolveImportSource();
  const tag = source === "pdl" ? "pdl" : "apollo";

  return {
    fullName: enriched.fullName,
    role: enriched.role,
    email: enriched.email ? enriched.email.toLowerCase() : "",
    phone: enriched.phone ?? "",
    location: enriched.location,
    city: enriched.city,
    state: enriched.state,
    linkedinUrl: enriched.linkedinUrl ?? "",
    experience: enriched.experience,
    currentEmployer: enriched.currentEmployer,
    certification: enriched.certification ?? "",
    // Persist contact availability so a re-enrich after upgrading reveals masked data.
    emailAvailable: enriched.emailAvailable ?? Boolean(enriched.email),
    phoneAvailable: enriched.phoneAvailable ?? Boolean(enriched.phone),
    status: "new_lead" as const,
    assignedRecruiterId: recruiterId,
    assignedRecruiterName: recruiterName,
    tags: [tag] as string[],
    apolloId: enriched.apolloId,
    source,
    apolloLastEnrichedAt: new Date(),
  };
}
