"use client";

import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCandidate, findDuplicateByEmail } from "@/lib/services/candidates";
import type { CandidateSource } from "@/types";

const FIELD_OPTIONS = [
  { key: "fullName", label: "Full Name", required: true },
  { key: "email", label: "Email", required: true },
  { key: "role", label: "Role" },
  { key: "phone", label: "Phone" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "location", label: "Location" },
  { key: "experience", label: "Experience" },
  { key: "currentEmployer", label: "Employer" },
] as const;

type FieldKey = (typeof FIELD_OPTIONS)[number]["key"];

interface CsvImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  recruiterId?: string;
  recruiterName?: string;
}

export function CsvImportWizard({
  open,
  onOpenChange,
  onComplete,
  recruiterId,
  recruiterName,
}: CsvImportWizardProps) {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({});
  const [preview, setPreview] = useState<{
    toImport: number;
    duplicates: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setPreview(null);
  };

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        if (!data.length) {
          toast.error("CSV is empty");
          return;
        }
        const hdrs = Object.keys(data[0] ?? {});
        setHeaders(hdrs);
        setRows(data);
        const auto: Partial<Record<FieldKey, string>> = {};
        hdrs.forEach((h) => {
          const lower = h.toLowerCase();
          if (lower.includes("email")) auto.email = h;
          if (lower.includes("name")) auto.fullName = h;
          if (lower === "role") auto.role = h;
          if (lower.includes("phone")) auto.phone = h;
          if (lower === "city") auto.city = h;
          if (lower === "state") auto.state = h;
        });
        setMapping(auto);
        setStep("map");
      },
    });
  };

  const runPreview = async () => {
    if (!mapping.email || !mapping.fullName) {
      toast.error("Map at least Full Name and Email columns");
      return;
    }
    let duplicates = 0;
    for (const row of rows) {
      const email = row[mapping.email!]?.trim().toLowerCase();
      if (!email) continue;
      const dup = await findDuplicateByEmail(email);
      if (dup) duplicates++;
    }
    setPreview({
      toImport: rows.length - duplicates,
      duplicates,
    });
    setStep("preview");
  };

  const runImport = async () => {
    if (!mapping.email || !mapping.fullName) return;
    setImporting(true);
    let imported = 0;
    let skipped = 0;
    try {
      for (const row of rows) {
        const email = row[mapping.email!]?.trim().toLowerCase();
        if (!email) continue;
        const dup = await findDuplicateByEmail(email);
        if (dup) {
          skipped++;
          continue;
        }
        const city = mapping.city ? row[mapping.city] ?? "" : "";
        const state = mapping.state ? row[mapping.state] ?? "" : "";
        await createCandidate({
          fullName: row[mapping.fullName!] ?? "Unknown",
          role: mapping.role ? row[mapping.role] ?? "Registered Nurse" : "Registered Nurse",
          email,
          phone: mapping.phone ? row[mapping.phone] ?? "" : "",
          location: mapping.location
            ? row[mapping.location]
            : `${city}, ${state}`.trim(),
          city,
          state,
          experience: mapping.experience ? row[mapping.experience] ?? "" : "",
          currentEmployer: mapping.currentEmployer ? row[mapping.currentEmployer] ?? "" : "",
          status: "new_lead",
          tags: [],
          source: "csv" as CandidateSource,
          assignedRecruiterId: recruiterId,
          assignedRecruiterName: recruiterName,
        });
        imported++;
      }
      toast.success(`Imported ${imported} (${skipped} duplicates skipped)`);
      setStep("done");
      onComplete();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file. You&apos;ll map columns and preview duplicates before importing.
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {FIELD_OPTIONS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label>
                  {f.label}
                  {"required" in f && f.required ? " *" : ""}
                </Label>
                <Select
                  value={mapping[f.key] ?? ""}
                  onValueChange={(v) =>
                    setMapping((m) => ({
                      ...m,
                      [f.key]: v && v !== "__skip__" ? v : undefined,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">— Skip —</SelectItem>
                    {headers.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <Button onClick={runPreview} className="w-full">
              Preview import ({rows.length} rows)
            </Button>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
              <p>
                <strong>{preview.toImport}</strong> candidates will be imported
              </p>
              <p className="text-muted-foreground">
                <strong>{preview.duplicates}</strong> duplicates will be skipped
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={runImport} disabled={importing} className="flex-1">
                {importing ? "Importing…" : "Confirm import"}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
