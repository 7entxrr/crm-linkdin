"use client";

import { useEffect, useState } from "react";
import { Bookmark, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSavedViews, createSavedView, deleteSavedView } from "@/lib/services/saved-views";
import type { CandidateFilters, SavedView } from "@/types";
import { toast } from "sonner";

interface SavedViewChipsProps {
  userId: string;
  filters: CandidateFilters;
  onApply: (filters: CandidateFilters) => void;
}

export function SavedViewChips({ userId, filters, onApply }: SavedViewChipsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");

  const load = () => getSavedViews(userId).then(setViews);

  useEffect(() => {
    void load();
  }, [userId]);

  const handleSave = async () => {
    if (!name.trim()) return;
    const { search: _s, ...filterOnly } = filters;
    void _s;
    await createSavedView({ userId, name: name.trim(), filters: filterOnly });
    toast.success("View saved");
    setSaveOpen(false);
    setName("");
    load();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSavedView(id);
    load();
  };

  const hasFilters = Object.entries(filters).some(
    ([k, v]) => k !== "search" && v !== undefined && v !== ""
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((v) => (
        <Badge
          key={v.id}
          variant="outline"
          className="cursor-pointer gap-1 pr-1 hover:bg-muted"
          onClick={() => onApply({ ...filters, ...v.filters })}
        >
          <Bookmark className="h-3 w-3" />
          {v.name}
          <button
            type="button"
            className="ml-1 rounded hover:bg-destructive/10"
            onClick={(e) => handleDelete(v.id, e)}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSaveOpen(true)}>
          Save current filters
        </Button>
      )}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save filter view</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. ICU nurses in TX"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={handleSave} className="w-full">
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
