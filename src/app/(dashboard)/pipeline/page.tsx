"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/loading-skeleton";
import { ComplianceBadges } from "@/components/shared/compliance-badges";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/rbac";
import { getCandidates, updateCandidateStatus } from "@/lib/services/candidates";
import { logActivity } from "@/lib/services/activities";
import { CANDIDATE_STATUSES } from "@/lib/constants";
import type { Candidate, CandidateStatus } from "@/types";

function KanbanCard({
  candidate,
  isDragging,
}: {
  candidate: Candidate;
  isDragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: candidate.id,
    data: { candidate },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-xl border border-border/60 bg-card p-3 shadow-sm transition-shadow active:cursor-grabbing ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-primary/20" : "hover:shadow-md"
      }`}
    >
      <Link
        href={`/candidates/${candidate.id}`}
        className="font-medium text-sm hover:text-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {candidate.fullName}
      </Link>
      <p className="mt-0.5 text-xs text-muted-foreground">{candidate.role}</p>
      <p className="text-xs text-muted-foreground">{candidate.state}</p>
      <div className="mt-2">
        <ComplianceBadges candidate={candidate} />
      </div>
    </div>
  );
}

function KanbanColumn({
  status,
  label,
  candidates,
}: {
  status: CandidateStatus;
  label: string;
  candidates: Candidate[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[260px] flex-1 flex-col rounded-2xl border border-border/60 bg-muted/20 ${
        isOver ? "ring-2 ring-primary/30 bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {candidates.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3 max-h-[calc(100vh-220px)]">
        {candidates.map((c) => (
          <KanbanCard key={c.id} candidate={c} />
        ))}
        {candidates.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">Drop here</p>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { profile, role } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getCandidates({}, isAdmin(role) ? undefined : profile?.id);
      setCandidates(list);
    } catch {
      toast.error("Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, [profile?.id, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCandidate = candidates.find((c) => c.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !profile) return;

    const newStatus = over.id as CandidateStatus;
    const candidate = candidates.find((c) => c.id === active.id);
    if (!candidate || candidate.status === newStatus) return;

    try {
      await updateCandidateStatus(candidate.id, newStatus);
      await logActivity({
        userId: profile.id,
        userName: profile.name,
        action: `Pipeline: moved to ${newStatus}`,
        entityType: "candidate",
        entityId: candidate.id,
      });
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, status: newStatus } : c))
      );
      toast.success(`Moved to ${CANDIDATE_STATUSES.find((s) => s.value === newStatus)?.label}`);
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Drag candidates across stages to update their status"
      />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {CANDIDATE_STATUSES.map(({ value, label }) => (
            <KanbanColumn
              key={value}
              status={value}
              label={label}
              candidates={candidates.filter((c) => c.status === value)}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCandidate ? <KanbanCard candidate={activeCandidate} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
