"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { candidateSchema, type CandidateFormValues } from "@/lib/validations/candidate";
import { CANDIDATE_STATUSES, HEALTHCARE_ROLES, US_STATES } from "@/lib/constants";
import type { Candidate, AppUser } from "@/types";

interface CandidateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: Candidate | null;
  recruiters: AppUser[];
  onSubmit: (data: CandidateFormValues) => Promise<void>;
}

export function CandidateFormDialog({
  open,
  onOpenChange,
  candidate,
  recruiters,
  onSubmit,
}: CandidateFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      status: "new_lead",
    },
  });

  useEffect(() => {
    if (candidate) {
      reset({
        fullName: candidate.fullName,
        role: candidate.role,
        email: candidate.email,
        phone: candidate.phone,
        location: candidate.location,
        city: candidate.city,
        state: candidate.state,
        linkedinUrl: candidate.linkedinUrl ?? "",
        experience: candidate.experience,
        currentEmployer: candidate.currentEmployer,
        certification: candidate.certification ?? "",
        status: candidate.status,
        assignedRecruiterId: candidate.assignedRecruiterId ?? "",
        tags: candidate.tags.join(", "),
      });
    } else {
      reset({ status: "new_lead" });
    }
  }, [candidate, reset, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{candidate ? "Edit Candidate" : "Add Candidate"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Full Name</Label>
            <Input {...register("fullName")} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={watch("role") ?? ""} onValueChange={(v) => v && setValue("role", v)}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                {HEALTHCARE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={watch("status") ?? "new_lead"} onValueChange={(v) => v && setValue("status", v as CandidateFormValues["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CANDIDATE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input {...register("phone")} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input {...register("city")} />
          </div>
          <div className="space-y-2">
            <Label>State</Label>
            <Select value={watch("state") ?? ""} onValueChange={(v) => v && setValue("state", v)}>
              <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Location</Label>
            <Input {...register("location")} placeholder="City, State" />
          </div>
          <div className="space-y-2">
            <Label>Experience</Label>
            <Input {...register("experience")} placeholder="5 years" />
          </div>
          <div className="space-y-2">
            <Label>Current Employer</Label>
            <Input {...register("currentEmployer")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>LinkedIn URL</Label>
            <Input {...register("linkedinUrl")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Certification</Label>
            <Input {...register("certification")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Assigned Recruiter</Label>
            <Select
              value={watch("assignedRecruiterId") ?? ""}
              onValueChange={(v) => setValue("assignedRecruiterId", v ?? "")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select recruiter">
                  {(value) =>
                    recruiters.find((r) => r.id === value)?.name ??
                    "Select recruiter"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Tags (comma separated)</Label>
            <Input {...register("tags")} placeholder="ICU, Travel" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : candidate ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
