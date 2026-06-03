"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UserPlus, MoreHorizontal, Trash2, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getRecruiters } from "@/lib/services/users";
import { getCandidates, bulkUpdateCandidates } from "@/lib/services/candidates";
import { apiFetch } from "@/lib/api-client";
import { uploadAvatar, validateImage } from "@/lib/firebase/storage";
import type { AppUser, Candidate } from "@/types";
import { UserCog } from "lucide-react";

export default function RecruitersPage() {
  const [recruiters, setRecruiters] = useState<AppUser[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState<string | null>(null);
  const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", status: "active" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, c] = await Promise.all([getRecruiters(), getCandidates()]);
    setRecruiters(r);
    setCandidates(c);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getAssignedCount = (id: string) =>
    candidates.filter((c) => c.assignedRecruiterId === id).length;

  const getResponseRate = (id: string) => {
    const assigned = candidates.filter((c) => c.assignedRecruiterId === id);
    if (!assigned.length) return 0;
    const replied = assigned.filter((c) =>
      ["replied", "interested", "interview_scheduled"].includes(c.status)
    ).length;
    return Math.round((replied / assigned.length) * 100);
  };

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", status: "active" });
    setAvatarFile(null);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectImage = (file: File | undefined) => {
    if (!file) return;
    const error = validateImage(file);
    if (error) {
      toast.error(error);
      return;
    }
    setAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }

      await apiFetch("/api/recruiters", {
        method: "POST",
        body: JSON.stringify({ ...form, avatarUrl }),
      });
      toast.success("Recruiter created");
      setFormOpen(false);
      resetForm();
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (recruiter: AppUser) => {
    const newStatus = recruiter.status === "active" ? "inactive" : "active";
    try {
      await apiFetch("/api/recruiters", {
        method: "PATCH",
        body: JSON.stringify({ id: recruiter.id, status: newStatus }),
      });
      toast.success(`Recruiter ${newStatus}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch("/api/recruiters", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      toast.success(`Removed ${deleteTarget.name}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove recruiter");
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async () => {
    if (!assignOpen || !selectedCandidates.length) return;
    const recruiter = recruiters.find((r) => r.id === assignOpen);
    await bulkUpdateCandidates(selectedCandidates, {
      assignedRecruiterId: assignOpen,
      assignedRecruiterName: recruiter?.name ?? "",
    });
    toast.success(`Assigned ${selectedCandidates.length} candidate(s)`);
    setAssignOpen(null);
    setSelectedCandidates([]);
    setAssignSearch("");
    load();
  };

  // Candidates that can be assigned to the selected recruiter: anyone NOT already
  // assigned to them (includes unassigned + those assigned to other recruiters).
  const assignableCandidates = candidates
    .filter((c) => c.assignedRecruiterId !== assignOpen)
    .filter((c) => {
      if (!assignSearch.trim()) return true;
      const q = assignSearch.toLowerCase();
      return (
        c.fullName.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6">
      <PageHeader title="Recruiters" description="Manage your recruitment team">
        <Button onClick={() => setFormOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />Add Recruiter
        </Button>
      </PageHeader>

      {loading ? (
        <CardGridSkeleton count={3} />
      ) : recruiters.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No recruiters"
          description="Add your first recruiter to start assigning candidates"
          actionLabel="Add Recruiter"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recruiters.map((r) => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={r.avatarUrl} alt={r.name} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-teal-600 text-primary-foreground">
                        {r.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.email}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setTimeout(() => setAssignOpen(r.id), 0)}>Assign Candidates</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleStatus(r)}>
                        {r.status === "active" ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTimeout(() => setDeleteTarget(r), 0)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="text-muted-foreground">Assigned</p>
                    <p className="font-semibold">{getAssignedCount(r.id)}</p>
                  </div>
                  <div className="text-sm text-right">
                    <p className="text-muted-foreground">Response Rate</p>
                    <p className="font-semibold">{getResponseRate(r.id)}%</p>
                  </div>
                  <Badge variant={r.status === "active" ? "default" : "secondary"}>
                    {r.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader><DialogTitle>Add Recruiter</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-border ring-offset-2">
                <AvatarImage src={avatarPreview ?? undefined} alt="preview" />
                <AvatarFallback className="bg-gradient-to-br from-primary to-teal-600 text-primary-foreground">
                  {form.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Profile image (optional)
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {avatarPreview ? "Change" : "Upload"}
                  </Button>
                  {avatarPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => {
                        setAvatarFile(null);
                        setAvatarPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return null;
                        });
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleSelectImage(e.target.files?.[0])}
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => v && setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Recruiter"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Remove ${deleteTarget?.name ?? "recruiter"}?`}
        description="This permanently deletes their login and unassigns their candidates. This cannot be undone."
        confirmLabel="Remove recruiter"
        onConfirm={handleDelete}
        loading={deleting}
      />

      <Dialog
        open={!!assignOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAssignOpen(null);
            setSelectedCandidates([]);
            setAssignSearch("");
          }
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Assign candidates to{" "}
              {recruiters.find((r) => r.id === assignOpen)?.name ?? "recruiter"}
            </DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Search by name, role, or email…"
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{assignableCandidates.length} available</span>
            {assignableCandidates.length > 0 && (
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() =>
                  setSelectedCandidates(
                    selectedCandidates.length === assignableCandidates.length
                      ? []
                      : assignableCandidates.map((c) => c.id)
                  )
                }
              >
                {selectedCandidates.length === assignableCandidates.length
                  ? "Clear all"
                  : "Select all"}
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {assignableCandidates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {candidates.length === 0
                  ? "No candidates yet. Import some from Find Prospects first."
                  : "Every candidate is already assigned to this recruiter."}
              </p>
            ) : (
              assignableCandidates.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded border p-2 cursor-pointer hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedCandidates.includes(c.id)}
                      onChange={(e) => {
                        setSelectedCandidates((prev) =>
                          e.target.checked
                            ? [...prev, c.id]
                            : prev.filter((id) => id !== c.id)
                        );
                      }}
                    />
                    <span className="text-sm">
                      {c.fullName} — {c.role}
                    </span>
                  </div>
                  {c.assignedRecruiterId && (
                    <Badge variant="secondary" className="text-[10px]">
                      {c.assignedRecruiterName || "Assigned"}
                    </Badge>
                  )}
                </label>
              ))
            )}
          </div>
          <Button onClick={handleAssign} disabled={!selectedCandidates.length}>
            Assign {selectedCandidates.length || ""} candidate
            {selectedCandidates.length === 1 ? "" : "s"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
