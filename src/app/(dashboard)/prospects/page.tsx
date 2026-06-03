"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Sparkles,
  Download,
  Mail,
  Phone,
  Link2,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HEALTHCARE_ROLES,
  US_STATE_OPTIONS,
  US_STATE_NAMES,
  CITIES_BY_STATE,
} from "@/lib/constants";
import {
  formatApolloLocation,
  ALL_CITIES,
  ALL_STATES,
} from "@/lib/apollo/format-location";
import { apiFetch } from "@/lib/api-client";
import type {
  ApolloPersonPreview,
  ApolloEnrichedPerson,
  ApolloSearchResult,
  ApolloImportResult,
} from "@/types/apollo";

type ApolloStatus = {
  configured?: boolean;
  accessible?: boolean;
  upgradeRequired?: boolean;
  sandbox?: boolean;
  provider?: "sandbox" | "pdl" | "apollo";
  message?: string;
};

function apolloToastError(err: unknown, fallback: string) {
  const e = err as Error & { upgradeRequired?: boolean; quotaExceeded?: boolean };
  const msg = e instanceof Error ? e.message : fallback;
  if (e.quotaExceeded) {
    toast.error("PDL monthly credits used up", {
      description:
        "Free plan includes ~100 search credits/month (1 per profile returned). Check usage at peopledatalabs.com or wait for the monthly reset.",
      duration: 14000,
    });
    return;
  }
  if (e.upgradeRequired) {
    toast.error(msg, {
      description: "Upgrade your Apollo plan at app.apollo.io to use People Search & Enrichment APIs.",
      duration: 12000,
    });
    return;
  }
  toast.error(msg || fallback);
}

export default function ProspectsPage() {
  const [titles, setTitles] = useState<string[]>(["Registered Nurse"]);
  const [state, setState] = useState(ALL_STATES);
  const [city, setCity] = useState(ALL_CITIES);
  const [orgDomain, setOrgDomain] = useState("");
  const [previews, setPreviews] = useState<ApolloPersonPreview[]>([]);
  const [enrichedMap, setEnrichedMap] = useState<Record<string, ApolloEnrichedPerson>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [totalEntries, setTotalEntries] = useState(0);
  const [searching, setSearching] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [apolloStatus, setApolloStatus] = useState<ApolloStatus | null>(null);
  const [pdlCreditsRemaining, setPdlCreditsRemaining] = useState<number | null>(null);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/apollo/status")
      .then((s) => setApolloStatus(s as ApolloStatus))
      .catch(() => setApolloStatus(null));
  }, []);

  const handleSearch = async () => {
    setSearching(true);
    setPreviews([]);
    setEnrichedMap({});
    setSelected(new Set());
    setSavedIds(new Set());
    try {
      const locations = formatApolloLocation(city, state);

      const result = await apiFetch("/api/apollo/search", {
        method: "POST",
        body: JSON.stringify({
          personTitles: titles,
          personLocations: locations.length ? locations : undefined,
          organizationDomains: orgDomain ? [orgDomain] : undefined,
          page: 1,
          perPage: 5,
        }),
      }) as ApolloSearchResult;

      setPreviews(result.people);
      setTotalEntries(result.totalEntries);
      if (result.creditsRemaining != null) {
        setPdlCreditsRemaining(result.creditsRemaining);
      }
      if (result.creditLimited) {
        toast.info(
          `Showing ${result.perPage} prospects to fit your remaining PDL credits${result.creditsRemaining != null ? ` (${result.creditsRemaining} left)` : ""}.`,
          { duration: 7000 }
        );
      }

      if (result.enriched?.length) {
        const map: Record<string, ApolloEnrichedPerson> = {};
        result.enriched.forEach((p) => {
          map[p.apolloId] = p;
        });
        setEnrichedMap(map);
        // Auto-save every fetched profile to Firestore immediately.
        await autoSaveProfiles(result.enriched);
      }

      if (result.people.length === 0) {
        toast.info("No prospects found. Try different filters.");
      }
    } catch (err) {
      apolloToastError(err, "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const autoSaveProfiles = async (people: ApolloEnrichedPerson[]) => {
    if (!people.length) return;
    setAutoSaving(true);
    try {
      const result = (await apiFetch("/api/apollo/import", {
        method: "POST",
        body: JSON.stringify({ people }),
      })) as ApolloImportResult;

      setSavedIds(new Set(people.map((p) => p.apolloId)));

      const parts: string[] = [];
      if (result.imported) parts.push(`${result.imported} saved to CRM`);
      if (result.skipped) parts.push(`${result.skipped} already in CRM`);
      toast.success(parts.join(" · ") || "Profiles saved to CRM");
    } catch (err) {
      toast.error(
        `Fetched, but auto-save failed: ${err instanceof Error ? err.message : "unknown error"}`
      );
    } finally {
      setAutoSaving(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === previews.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(previews.map((p) => p.id)));
    }
  };

  const handleEnrich = async () => {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.error("Select at least one prospect");
      return;
    }

    setEnriching(true);
    const newEnriched = { ...enrichedMap };
    try {
      for (let i = 0; i < ids.length; i += 10) {
        const chunk = ids.slice(i, i + 10);
        const { people } = await apiFetch("/api/apollo/enrich", {
          method: "POST",
          body: JSON.stringify({ apolloIds: chunk }),
        }) as { people: ApolloEnrichedPerson[] };

        people.forEach((p) => {
          newEnriched[p.apolloId] = p;
        });
      }
      setEnrichedMap(newEnriched);
      toast.success(`Enriched ${Object.keys(newEnriched).length} profile(s)`);
    } catch (err) {
      apolloToastError(err, "Enrich failed");
    } finally {
      setEnriching(false);
    }
  };

  const handleImport = async () => {
    const toImport = Array.from(selected)
      .map((id) => enrichedMap[id])
      .filter(Boolean) as ApolloEnrichedPerson[];

    if (!toImport.length) {
      toast.error("Enrich selected prospects before importing");
      return;
    }

    setImporting(true);
    try {
      const result = await apiFetch("/api/apollo/import", {
        method: "POST",
        body: JSON.stringify({ people: toImport }),
      }) as ApolloImportResult;

      toast.success(
        `Imported ${result.imported}, skipped ${result.skipped}`
      );
      if (result.imported > 0) {
        setSelected(new Set());
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const toggleTitle = (role: string) => {
    setTitles((prev) =>
      prev.includes(role) ? prev.filter((t) => t !== role) : [...prev, role]
    );
  };

  const enrichedList = Object.values(enrichedMap);
  const contactsMasked =
    enrichedList.length > 0 &&
    enrichedList.some((p) => (p.emailAvailable || p.phoneAvailable) && !p.email && !p.phone);

  const providerName =
    apolloStatus?.provider === "pdl"
      ? "People Data Labs"
      : apolloStatus?.provider === "sandbox"
        ? "sandbox data"
        : "Apollo.io";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Find Prospects"
        description={`Search ${providerName} for real healthcare professionals and import them into your CRM`}
      >
        <Link
          href="/candidates"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border/60 bg-card/80 px-4 text-sm font-medium shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          View Candidates
        </Link>
      </PageHeader>

      {apolloStatus?.provider === "pdl" && apolloStatus.accessible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="rounded-xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 to-primary/5 px-5 py-4 text-sm shadow-sm"
        >
          <p className="font-medium text-teal-950 dark:text-teal-100">
            People Data Labs is active
          </p>
          <p className="mt-1 text-muted-foreground">
            {apolloStatus.message} Each search returns up to 5 profiles (1 credit each) to
            conserve your free tier (~100/month). Profiles load on search — no separate enrich
            step needed.
            {pdlCreditsRemaining != null && (
              <span className="mt-1 block font-medium text-teal-900 dark:text-teal-200">
                Credits remaining this month: {pdlCreditsRemaining}
              </span>
            )}
          </p>
        </motion.div>
      )}

      {apolloStatus?.sandbox && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-teal-500/5 px-5 py-4 text-sm shadow-sm"
        >
          <p className="font-medium text-blue-950 dark:text-blue-100">
            Sandbox mode is ON
          </p>
          <p className="mt-1 text-muted-foreground">
            Searches return sample healthcare professionals so you can test the
            full search → enrich → import flow without an Apollo paid plan. No
            credits are used. Set <code className="text-xs">APOLLO_SANDBOX=false</code>{" "}
            in <code className="text-xs">.env.local</code> for live data.
          </p>
        </motion.div>
      )}

      {apolloStatus &&
        apolloStatus.provider !== "pdl" &&
        !apolloStatus.sandbox &&
        (!apolloStatus.configured || apolloStatus.upgradeRequired) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/5 px-5 py-4 text-sm shadow-sm"
        >
          <p className="font-medium text-amber-950 dark:text-amber-100">
            {!apolloStatus.configured
              ? "Apollo API key not loaded"
              : "Apollo plan upgrade required"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {apolloStatus.message}
            {!apolloStatus.configured && (
              <> Save <code className="text-xs">APOLLO_API_KEY</code> in{" "}
                <code className="text-xs">.env.local</code> and restart{" "}
                <code className="text-xs">npm run dev</code>.</>
            )}
            {apolloStatus.upgradeRequired && (
              <>
                {" "}
                <a
                  href="https://app.apollo.io/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline"
                >
                  Upgrade at Apollo
                </a>{" "}
                (Basic or higher with API access).
              </>
            )}
          </p>
        </motion.div>
      )}

      <Card className="border-border/60 bg-card/90 backdrop-blur-sm">
        <CardHeader className="border-b border-border/50 bg-muted/20">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Search className="h-4 w-4" />
            </span>
            Search filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label className="mb-2 block">Job titles</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {HEALTHCARE_ROLES.slice(0, 8).map((role) => (
                <Badge
                  key={role}
                  variant={titles.includes(role) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTitle(role)}
                >
                  {role}
                </Badge>
              ))}
            </div>
            <Select
              value=""
              onValueChange={(v) => v && !titles.includes(v) && setTitles([...titles, v])}
            >
              <SelectTrigger className="mt-2 w-full max-w-xs">
                <SelectValue placeholder="Add more roles..." />
              </SelectTrigger>
              <SelectContent>
                {HEALTHCARE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>State</Label>
              <Select
                value={state}
                onValueChange={(v) => {
                  const next = v ?? ALL_STATES;
                  setState(next);
                  setCity(next === ALL_STATES ? ALL_CITIES : "");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a state">
                    {state === ALL_STATES
                      ? "All states"
                      : US_STATE_NAMES[state] ?? state}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value={ALL_STATES}>All states</SelectItem>
                  {US_STATE_OPTIONS.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>
                City <span className="text-red-500">*</span>
              </Label>
              <Select
                value={city || undefined}
                onValueChange={(v) => setCity(v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      state === ALL_STATES ? "All (United States)" : "Select a city"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {state === ALL_STATES ? (
                    <SelectItem value={ALL_CITIES}>All (United States)</SelectItem>
                  ) : (
                    <>
                      <SelectItem value={ALL_CITIES}>
                        All cities in {US_STATE_NAMES[state] ?? state}
                      </SelectItem>
                      {(CITIES_BY_STATE[state] ?? []).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employer domain (optional)</Label>
              <Input
                placeholder="hospital.org"
                value={orgDomain}
                onChange={(e) => setOrgDomain(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={searching || titles.length === 0 || !city}
          >
            {searching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search
              </>
            )}
          </Button>
          {!city && (
            <p className="text-xs text-red-500">
              Select a city or &quot;All cities&quot; to search ({"\u002A"} required).
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {apolloStatus?.provider === "pdl"
              ? "Search uses People Data Labs credits (~100/month free). Profiles load right after search."
              : "Search uses Apollo credits. Enrich reveals LinkedIn URLs, emails, and phones."}
          </p>
        </CardContent>
      </Card>

      {previews.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Results ({previews.length} of {totalEntries.toLocaleString()})
              </CardTitle>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {autoSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving to CRM…
                  </>
                ) : savedIds.size > 0 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                    Auto-saved to your CRM — view under Candidates.
                  </>
                ) : (
                  "Fetched profiles are saved to your CRM automatically."
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnrich}
                disabled={enriching || selected.size === 0}
              >
                {enriching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Enrich selected
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || selected.size === 0}
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Re-save selected
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {contactsMasked && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 dark:bg-amber-950/30">
                <div className="flex items-start gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-amber-900 dark:text-amber-100">
                    <span className="font-semibold">Email &amp; phone are hidden on the free plan.</span>{" "}
                    Upgrade to a People Data Labs premium plan to reveal verified email
                    addresses and phone numbers. Everything else (name, role, employer,
                    LinkedIn, certification) is already saved.
                  </p>
                </div>
                <a
                  href="https://www.peopledatalabs.com/pricing"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button
                    size="sm"
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Upgrade to Premium
                    <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </a>
              </div>
            )}
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === previews.length && previews.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Cert</TableHead>
                    <TableHead>Employer</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Exp.</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead>CRM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previews.map((p) => {
                    const enriched = enrichedMap[p.id];
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => toggleSelect(p.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {enriched?.fullName ?? `${p.firstName} ${p.lastNameObfuscated}`}
                        </TableCell>
                        <TableCell>{enriched?.role ?? p.title ?? "—"}</TableCell>
                        <TableCell>
                          {enriched?.certification ? (
                            <Badge variant="secondary" className="text-xs">
                              {enriched.certification}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {enriched?.currentEmployer ?? p.organizationName ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {enriched?.location && enriched.location !== "Unknown"
                            ? enriched.location
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {enriched?.experience && enriched.experience !== "Not specified"
                            ? enriched.experience
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge
                              variant="outline"
                              className="text-xs"
                              title={
                                enriched?.email
                                  ? enriched.email
                                  : enriched?.emailAvailable || p.hasEmail
                                    ? "On file — enrich to reveal (paid plan)"
                                    : "No email on file"
                              }
                            >
                              <Mail className="mr-1 h-3 w-3" />
                              {enriched?.email
                                ? "Yes"
                                : enriched?.emailAvailable || p.hasEmail
                                  ? "Masked"
                                  : "—"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              title={
                                enriched?.phone
                                  ? enriched.phone
                                  : enriched?.phoneAvailable || p.hasPhone
                                    ? "On file — enrich to reveal (paid plan)"
                                    : "No phone on file"
                              }
                            >
                              <Phone className="mr-1 h-3 w-3" />
                              {enriched?.phone
                                ? "Yes"
                                : enriched?.phoneAvailable || p.hasPhone
                                  ? "Masked"
                                  : "—"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {enriched?.linkedinUrl ? (
                            <a
                              href={enriched.linkedinUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
                            >
                              <Link2 className="h-3 w-3" />
                              Profile
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {savedIds.has(p.id) ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              Saved
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
