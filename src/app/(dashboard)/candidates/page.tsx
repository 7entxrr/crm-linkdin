"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  Filter,
  Download,
  Upload,
  Trash2,
  MoreHorizontal,
  Eye,
  Pencil,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ComplianceBadges } from "@/components/shared/compliance-badges";
import { Badge } from "@/components/ui/badge";
import type { CandidateSource } from "@/types";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { CandidateFormDialog } from "@/components/candidates/candidate-form-dialog";
import { FilterDrawer } from "@/components/candidates/filter-drawer";
import { CsvImportWizard } from "@/components/candidates/csv-import-wizard";
import { SavedViewChips } from "@/components/candidates/saved-view-chips";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/rbac";
import {
  getCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  bulkDeleteCandidates,
  bulkUpdateCandidates,
  findDuplicateByEmail,
} from "@/lib/services/candidates";
import { getRecruiters } from "@/lib/services/users";
import { logActivity } from "@/lib/services/activities";
import { apiFetch } from "@/lib/api-client";
import type { Candidate, CandidateFilters } from "@/types";
import type { CandidateFormValues } from "@/lib/validations/candidate";
import { Users } from "lucide-react";
import { format } from "date-fns";

export default function CandidatesPage() {
  const { profile, role } = useAuth();
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [recruiters, setRecruiters] = useState<Awaited<ReturnType<typeof getRecruiters>>>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editing, setEditing] = useState<Candidate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<
    { email: string; candidates: { id: string; fullName: string; email: string }[] }[]
  >([]);
  const [filters, setFilters] = useState<CandidateFilters>({
    search: searchParams.get("search") ?? undefined,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        getCandidates(filters, isAdmin(role) ? undefined : profile?.id),
        getRecruiters(),
      ]);
      setCandidates(c);
      setRecruiters(r);
    } catch {
      toast.error("Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, [filters, profile, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreateOrUpdate = async (data: CandidateFormValues) => {
    const recruiterId = data.assignedRecruiterId?.trim() || "";
    const recruiter = recruiterId
      ? recruiters.find((r) => r.id === recruiterId)
      : undefined;
    const payload = {
      fullName: data.fullName,
      role: data.role,
      email: data.email.toLowerCase(),
      phone: data.phone,
      location: data.location,
      city: data.city,
      state: data.state,
      linkedinUrl: data.linkedinUrl?.trim() || "",
      experience: data.experience,
      currentEmployer: data.currentEmployer,
      certification: data.certification?.trim() || "",
      status: data.status,
      assignedRecruiterId: recruiterId,
      assignedRecruiterName: recruiterId
        ? recruiter?.name ?? editing?.assignedRecruiterName ?? ""
        : "",
      tags: data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      source: editing ? editing.source : ("manual" as const),
    };

    if (!editing) {
      const dup = await findDuplicateByEmail(payload.email);
      if (dup) {
        toast.error("Duplicate candidate with this email exists");
        return;
      }
      const id = await createCandidate(payload);
      await logActivity({
        userId: profile!.id,
        userName: profile!.name,
        action: "Candidate created",
        entityType: "candidate",
        entityId: id,
      });
      toast.success("Candidate created");
    } else {
      await updateCandidate(editing.id, payload);
      await logActivity({
        userId: profile!.id,
        userName: profile!.name,
        action: "Candidate updated",
        entityType: "candidate",
        entityId: editing.id,
      });
      toast.success("Candidate updated");
    }
    setFormOpen(false);
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCandidate(deleteId);
    await logActivity({
      userId: profile!.id,
      userName: profile!.name,
      action: "Candidate deleted",
      entityType: "candidate",
      entityId: deleteId,
    });
    toast.success("Candidate deleted");
    setDeleteId(null);
    load();
  };

  const handleBulkDelete = async () => {
    await bulkDeleteCandidates(selected);
    toast.success(`Deleted ${selected.length} candidates`);
    setSelected([]);
    setBulkDeleteOpen(false);
    load();
  };

  const handleBulkAssign = async (recruiterId: string | null) => {
    if (!recruiterId) return;
    const recruiter = recruiters.find((r) => r.id === recruiterId);
    await bulkUpdateCandidates(selected, {
      assignedRecruiterId: recruiterId,
      assignedRecruiterName: recruiter?.name ?? "",
    });
    toast.success("Candidates assigned");
    setSelected([]);
    load();
  };

  const exportCsv = () => {
    const csv = Papa.unparse(
      candidates.map((c) => ({
        fullName: c.fullName,
        role: c.role,
        email: c.email,
        phone: c.phone,
        location: c.location,
        city: c.city,
        state: c.state,
        experience: c.experience,
        currentEmployer: c.currentEmployer,
        status: c.status,
      }))
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "candidates.csv";
    a.click();
    toast.success("CSV exported");
  };

  const importCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        let imported = 0;
        let duplicates = 0;
        for (const row of results.data as Record<string, string>[]) {
          if (!row.email) continue;
          const dup = await findDuplicateByEmail(row.email);
          if (dup) {
            duplicates++;
            continue;
          }
          await createCandidate({
            fullName: row.fullName ?? row.name ?? "Unknown",
            role: row.role ?? "Registered Nurse",
            email: row.email.toLowerCase(),
            phone: row.phone ?? "",
            location: row.location ?? `${row.city}, ${row.state}`,
            city: row.city ?? "",
            state: row.state ?? "",
            experience: row.experience ?? "",
            currentEmployer: row.currentEmployer ?? row.employer ?? "",
            status: "new_lead",
            tags: [],
            source: "csv",
            assignedRecruiterId: profile?.id,
            assignedRecruiterName: profile?.name,
          });
          imported++;
        }
        toast.success(`Imported ${imported} candidates (${duplicates} duplicates skipped)`);
        load();
      },
    });
    e.target.value = "";
  };

  const columns: ColumnDef<Candidate>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => {
              table.toggleAllPageRowsSelected(!!v);
              setSelected(v ? candidates.map((c) => c.id) : []);
            }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selected.includes(row.original.id)}
            onCheckedChange={(v) => {
              setSelected((prev) =>
                v ? [...prev, row.original.id] : prev.filter((id) => id !== row.original.id)
              );
            }}
          />
        ),
      },
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <div className="space-y-1">
            <Link href={`/candidates/${row.original.id}`} className="font-medium hover:text-primary">
              {row.original.fullName}
            </Link>
            <ComplianceBadges candidate={row.original} />
          </div>
        ),
      },
      { accessorKey: "role", header: "Role" },
      { accessorKey: "email", header: "Email" },
      { accessorKey: "state", header: "State" },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => {
          const src = (row.original.source ?? "manual") as CandidateSource;
          const labels: Record<CandidateSource, string> = {
            apollo: "Apollo",
            pdl: "PDL",
            manual: "Manual",
            csv: "CSV",
          };
          return (
            <Badge variant={src === "apollo" ? "default" : "outline"} className="text-xs">
              {labels[src]}
            </Badge>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "assignedRecruiterName",
        header: "Recruiter",
        cell: ({ row }) => row.original.assignedRecruiterName ?? "—",
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => format(row.original.createdAt, "MMM d, yyyy"),
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.location.href = `/candidates/${row.original.id}`}>
                <Eye className="mr-2 h-4 w-4" />View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditing(row.original); setFormOpen(true); }}>
                <Pencil className="mr-2 h-4 w-4" />Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(row.original.id)}>
                <Trash2 className="mr-2 h-4 w-4" />Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [candidates, selected]
  );

  const pageTitle = isAdmin(role) ? "Candidates" : "My Candidates";

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description="Real candidates from Apollo.io — search, enrich, and manage your pipeline"
      >
        <Link
          href="/prospects"
          className={cn(buttonVariants({ variant: "default" }), "inline-flex")}
        >
          <Search className="mr-2 h-4 w-4" />Find Prospects
        </Link>
        <Button variant="outline" onClick={() => setFilterOpen(true)}>
          <Filter className="mr-2 h-4 w-4" />Filters
        </Button>
        <Button variant="outline" onClick={() => setCsvOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />Import CSV
        </Button>
        {isAdmin(role) && (
          <Button
            variant="outline"
            onClick={async () => {
              const res = (await apiFetch("/api/candidates/duplicates")) as {
                groups: typeof duplicateGroups;
              };
              setDuplicateGroups(res.groups);
              setDuplicatesOpen(true);
            }}
          >
            Find Duplicates
          </Button>
        )}
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />Export
        </Button>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />Add Candidate
        </Button>
      </PageHeader>

      {profile && (
        <SavedViewChips
          userId={profile.id}
          filters={filters}
          onApply={setFilters}
        />
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <span className="text-sm font-medium">{selected.length} selected</span>
          {isAdmin(role) && (
            <Select onValueChange={handleBulkAssign}>
              <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Assign recruiter" /></SelectTrigger>
              <SelectContent>
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="mr-1 h-3 w-3" />Delete
          </Button>
        </div>
      )}

      {loading ? (
        <TableSkeleton />
      ) : candidates.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Import real healthcare professionals from Apollo.io or add manually"
          actionLabel="Find Prospects"
          onAction={() => { window.location.href = "/prospects"; }}
        />
      ) : (
        <DataTable columns={columns} data={candidates} />
      )}

      <CandidateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        candidate={editing}
        recruiters={recruiters}
        onSubmit={handleCreateOrUpdate}
      />
      <FilterDrawer
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onChange={setFilters}
        recruiters={recruiters}
        showRecruiterFilter={isAdmin(role)}
      />
      <CsvImportWizard
        open={csvOpen}
        onOpenChange={setCsvOpen}
        onComplete={load}
        recruiterId={profile?.id}
        recruiterName={profile?.name}
      />

      <ConfirmDialog
        open={duplicatesOpen}
        onOpenChange={setDuplicatesOpen}
        title="Duplicate candidates"
        description={
          duplicateGroups.length === 0
            ? "No duplicate emails found."
            : `${duplicateGroups.length} duplicate group(s) found. Merge keeps the first entry.`
        }
        confirmLabel="Close"
        onConfirm={() => setDuplicatesOpen(false)}
      />

      {duplicatesOpen && duplicateGroups.length > 0 && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          {duplicateGroups.map((g) => (
            <div key={g.email} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{g.email}</p>
                <p className="text-xs text-muted-foreground">
                  {g.candidates.map((c) => c.fullName).join(", ")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const [keep, ...rest] = g.candidates;
                  await apiFetch("/api/candidates/duplicates", {
                    method: "POST",
                    body: JSON.stringify({
                      keepId: keep.id,
                      mergeIds: rest.map((c) => c.id),
                    }),
                  });
                  toast.success("Merged duplicates");
                  load();
                  const res = (await apiFetch("/api/candidates/duplicates")) as {
                    groups: typeof duplicateGroups;
                  };
                  setDuplicateGroups(res.groups);
                }}
              >
                Merge into {g.candidates[0].fullName}
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete candidate?"
        description="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.length} candidates?`}
        description="This will permanently remove selected candidates."
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
