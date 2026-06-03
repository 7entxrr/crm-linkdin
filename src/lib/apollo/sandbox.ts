import type {
  ApolloSearchParams,
  ApolloSearchResult,
  ApolloPersonPreview,
  ApolloEnrichedPerson,
} from "@/types/apollo";

/**
 * Sandbox mode lets you exercise the full Find Prospects → Enrich → Import flow
 * without a paid Apollo plan. Enable with APOLLO_SANDBOX=true in .env.local.
 * Data is fake but flows through the exact same code path as live Apollo data.
 */
export function isSandbox(): boolean {
  return process.env.APOLLO_SANDBOX?.trim().toLowerCase() === "true";
}

interface SandboxPerson {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  employer: string;
  linkedin: string;
  experience: string;
}

const SANDBOX_PEOPLE: SandboxPerson[] = [
  {
    id: "sbx_rn_0001",
    firstName: "Maria",
    lastName: "Gonzalez",
    title: "Registered Nurse",
    email: "maria.gonzalez@example-health.org",
    phone: "+1 713 555 0142",
    city: "Houston",
    state: "Texas",
    employer: "Memorial Hermann Health System",
    linkedin: "https://www.linkedin.com/in/maria-gonzalez-rn",
    experience: "8 years in acute care and ICU nursing",
  },
  {
    id: "sbx_rn_0002",
    firstName: "James",
    lastName: "Carter",
    title: "Registered Nurse",
    email: "james.carter@example-clinic.com",
    phone: "+1 469 555 0198",
    city: "Dallas",
    state: "Texas",
    employer: "Baylor Scott & White Health",
    linkedin: "https://www.linkedin.com/in/james-carter-bsn",
    experience: "5 years in emergency department nursing",
  },
  {
    id: "sbx_np_0003",
    firstName: "Priya",
    lastName: "Nair",
    title: "Nurse Practitioner",
    email: "priya.nair@example-care.org",
    phone: "+1 512 555 0176",
    city: "Austin",
    state: "Texas",
    employer: "Ascension Seton",
    linkedin: "https://www.linkedin.com/in/priya-nair-np",
    experience: "10 years; family practice and primary care",
  },
  {
    id: "sbx_rt_0004",
    firstName: "Daniel",
    lastName: "Okafor",
    title: "Respiratory Therapist",
    email: "daniel.okafor@example-med.com",
    phone: "+1 210 555 0123",
    city: "San Antonio",
    state: "Texas",
    employer: "Methodist Healthcare",
    linkedin: "https://www.linkedin.com/in/daniel-okafor-rt",
    experience: "6 years in critical care respiratory therapy",
  },
  {
    id: "sbx_pt_0005",
    firstName: "Emily",
    lastName: "Nguyen",
    title: "Physical Therapist",
    email: "emily.nguyen@example-rehab.org",
    phone: "+1 832 555 0167",
    city: "Houston",
    state: "Texas",
    employer: "TIRR Memorial Hermann",
    linkedin: "https://www.linkedin.com/in/emily-nguyen-dpt",
    experience: "7 years in neuro and orthopedic rehab",
  },
  {
    id: "sbx_cna_0006",
    firstName: "Robert",
    lastName: "Mensah",
    title: "Certified Nursing Assistant",
    email: "robert.mensah@example-senior.com",
    phone: "+1 214 555 0188",
    city: "Dallas",
    state: "Texas",
    employer: "Brookdale Senior Living",
    linkedin: "https://www.linkedin.com/in/robert-mensah-cna",
    experience: "4 years in long-term and memory care",
  },
];

function matchesFilters(p: SandboxPerson, params: ApolloSearchParams): boolean {
  if (params.personTitles?.length) {
    const wanted = params.personTitles.map((t) => t.toLowerCase());
    if (!wanted.some((t) => p.title.toLowerCase().includes(t) || t.includes(p.title.toLowerCase()))) {
      return false;
    }
  }
  if (params.personLocations?.length) {
    const loc = params.personLocations.join(" ").toLowerCase();
    const inLoc = loc.includes(p.state.toLowerCase()) || loc.includes(p.city.toLowerCase());
    if (!inLoc) return false;
  }
  return true;
}

export function sandboxSearch(params: ApolloSearchParams): ApolloSearchResult {
  const matched = SANDBOX_PEOPLE.filter((p) => matchesFilters(p, params));
  const list = matched.length ? matched : SANDBOX_PEOPLE;
  const perPage = params.perPage ?? 25;

  const people: ApolloPersonPreview[] = list.slice(0, perPage).map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastNameObfuscated: `${p.lastName[0]}${"*".repeat(Math.max(p.lastName.length - 1, 2))}`,
    title: p.title,
    organizationName: p.employer,
    hasEmail: true,
    hasPhone: true,
    hasCity: true,
    hasState: true,
    lastRefreshedAt: new Date().toISOString(),
  }));

  return {
    people,
    totalEntries: list.length,
    page: params.page ?? 1,
    perPage,
  };
}

function toEnriched(p: SandboxPerson): ApolloEnrichedPerson {
  return {
    apolloId: p.id,
    fullName: `${p.firstName} ${p.lastName}`,
    role: p.title,
    email: p.email,
    phone: p.phone,
    location: `${p.city}, ${p.state}`,
    city: p.city,
    state: p.state,
    linkedinUrl: p.linkedin,
    experience: p.experience,
    currentEmployer: p.employer,
    title: p.title,
    organizationName: p.employer,
  };
}

export function sandboxEnrich(apolloIds: string[]): ApolloEnrichedPerson[] {
  return apolloIds
    .map((id) => SANDBOX_PEOPLE.find((p) => p.id === id))
    .filter((p): p is SandboxPerson => Boolean(p))
    .map(toEnriched);
}

export function sandboxEnrichByMatch(predicate: (p: SandboxPerson) => boolean): ApolloEnrichedPerson | null {
  const found = SANDBOX_PEOPLE.find(predicate);
  return found ? toEnriched(found) : null;
}
