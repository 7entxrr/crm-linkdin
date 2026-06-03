"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CANDIDATE_STATUSES, HEALTHCARE_ROLES, US_STATES } from "@/lib/constants";
import type { CandidateFilters, AppUser } from "@/types";

const ALL = "__all__";

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CandidateFilters;
  onChange: (filters: CandidateFilters) => void;
  recruiters: AppUser[];
  showRecruiterFilter?: boolean;
}

export function FilterDrawer({
  open,
  onOpenChange,
  filters,
  onChange,
  recruiters,
  showRecruiterFilter = true,
}: FilterDrawerProps) {
  const update = (key: keyof CandidateFilters, value: string) => {
    onChange({ ...filters, [key]: value && value !== ALL ? value : undefined });
  };

  const clear = () => onChange({ search: filters.search });

  const activeCount = [
    filters.role,
    filters.state,
    filters.city,
    filters.experience,
    filters.status,
    showRecruiterFilter ? filters.recruiterId : undefined,
  ].filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border/60 bg-muted/30 px-6 py-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            Filter Candidates
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeCount} active
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={filters.role ?? ALL}
              onValueChange={(v) => update("role", v ?? ALL)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={ALL}>All roles</SelectItem>
                {HEALTHCARE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Select
                value={filters.state ?? ALL}
                onValueChange={(v) => update("state", v ?? ALL)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All states">
                    {filters.state ?? "All states"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={ALL}>All states</SelectItem>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                value={filters.city ?? ""}
                onChange={(e) => update("city", e.target.value)}
                placeholder="e.g. Houston"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Experience</Label>
            <Input
              value={filters.experience ?? ""}
              onChange={(e) => update("experience", e.target.value)}
              placeholder="e.g. 5 years"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={filters.status ?? ALL}
              onValueChange={(v) => update("status", v ?? ALL)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {CANDIDATE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showRecruiterFilter && (
            <div className="space-y-1.5">
              <Label>Recruiter</Label>
              <Select
                value={filters.recruiterId ?? ALL}
                onValueChange={(v) => update("recruiterId", v ?? ALL)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All recruiters">
                    {(value) =>
                      value === ALL
                        ? "All recruiters"
                        : recruiters.find((r) => r.id === value)?.name ??
                          "All recruiters"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value={ALL}>All recruiters</SelectItem>
                  {recruiters.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border/60 bg-muted/30 px-6 py-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={clear}
            disabled={activeCount === 0}
          >
            <X className="mr-1.5 h-4 w-4" />
            Clear
          </Button>
          <Button className="flex-1" onClick={() => onOpenChange(false)}>
            Apply{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
