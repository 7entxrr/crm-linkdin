"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { getActivities } from "@/lib/services/activities";
import type { Activity as ActivityType } from "@/types";
import type { ColumnDef } from "@tanstack/react-table";

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActivities(100).then((a) => {
      setActivities(a);
      setLoading(false);
    });
  }, []);

  const columns: ColumnDef<ActivityType>[] = [
    { accessorKey: "userName", header: "User" },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "entityType", header: "Type" },
    {
      accessorKey: "timestamp",
      header: "Time",
      cell: ({ row }) => format(row.original.timestamp, "PPp"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Activity Logs" description="System-wide audit trail" />
      {loading ? (
        <TableSkeleton />
      ) : activities.length === 0 ? (
        <EmptyState icon={Activity} title="No activity" description="Actions will appear here as users work in the system" />
      ) : (
        <DataTable columns={columns} data={activities} pageSize={15} />
      )}
    </div>
  );
}
