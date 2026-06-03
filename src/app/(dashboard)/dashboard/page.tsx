"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCog,
  Mail,
  TrendingUp,
  Heart,
  CalendarClock,
  Eye,
  MousePointerClick,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StaggerContainer, StaggerItem } from "@/components/shared/animated-section";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/rbac";
import { getCandidates } from "@/lib/services/candidates";
import { getRecruiters } from "@/lib/services/users";
import { getOutreachs } from "@/lib/services/outreachs";
import { getFollowups } from "@/lib/services/followups";
import { getActivities } from "@/lib/services/activities";
import {
  computeDashboardStats,
  candidatesByRole,
} from "@/lib/analytics";
import { format } from "date-fns";
import { TasksWidget } from "@/components/dashboard/tasks-widget";
import type { Activity, Followup } from "@/types";

export default function DashboardPage() {
  const { profile, role } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReturnType<typeof computeDashboardStats> | null>(null);
  const [roleChart, setRoleChart] = useState<{ name: string; value: number }[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [todayFollowups, setTodayFollowups] = useState<Followup[]>([]);

  useEffect(() => {
    async function load() {
      const recruiterFilter = isAdmin(role) ? undefined : profile?.id;
      const [candidates, recruiters, outreachs, followups, acts] = await Promise.all([
        getCandidates({}, recruiterFilter),
        getRecruiters(),
        getOutreachs(),
        getFollowups(),
        getActivities(8),
      ]);

      const filteredOutreach = isAdmin(role)
        ? outreachs
        : outreachs.filter((o) => o.recruiterId === profile?.id);

      setStats(computeDashboardStats(candidates, recruiters, filteredOutreach));
      setRoleChart(candidatesByRole(candidates));
      setActivities(acts);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      setTodayFollowups(
        followups.filter((f) => {
          const d = f.scheduledFor;
          return (
            f.status === "scheduled" &&
            d >= today &&
            d < tomorrow &&
            (isAdmin(role) || f.recruiterId === profile?.id)
          );
        })
      );
      setLoading(false);
    }
    if (profile) load();
  }, [profile, role]);

  if (loading || !stats) return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Loading..." />
      <CardGridSkeleton />
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${profile?.name?.split(" ")[0]}`}
        description={
          isAdmin(role)
            ? "Organization-wide recruitment overview"
            : "Your candidate pipeline and follow-ups"
        }
      />

      <StaggerContainer className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StaggerItem>
          <StatCard title="Total Candidates" value={stats.totalCandidates} icon={Users} index={0} />
        </StaggerItem>
        {isAdmin(role) && (
          <StaggerItem>
            <StatCard title="Recruiters" value={stats.totalRecruiters} icon={UserCog} index={1} />
          </StaggerItem>
        )}
        <StaggerItem>
          <StatCard title="Outreach Sent" value={stats.totalOutreach} icon={Mail} index={2} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Response Rate" value={`${stats.responseRate}%`} icon={TrendingUp} index={3} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Interested" value={stats.interestedCandidates} icon={Heart} index={4} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Open Rate" value={`${stats.openRate}%`} icon={Eye} index={5} />
        </StaggerItem>
        <StaggerItem>
          <StatCard title="Click Rate" value={`${stats.clickRate}%`} icon={MousePointerClick} index={6} />
        </StaggerItem>
      </StaggerContainer>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/90 backdrop-blur-sm transition-shadow hover:shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="text-base font-semibold">Candidates by Role</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <TasksWidget />

        <Card className="border-border/60 bg-card/90 backdrop-blur-sm transition-shadow hover:shadow-md lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/20">
            <CardTitle className="text-base font-semibold">Today&apos;s Follow-ups</CardTitle>
            <Link href="/followups" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayFollowups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No follow-ups scheduled today</p>
            ) : (
              todayFollowups.slice(0, 5).map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{f.candidateName}</p>
                      <p className="text-xs text-muted-foreground">{f.sequenceStep}</p>
                    </div>
                  </div>
                  <Link
                    href={`/candidates/${f.candidateId}`}
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  >
                    View
                  </Link>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin(role) && (
        <Card className="border-border/60 bg-card/90 backdrop-blur-sm">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {activities.map((a) => (
              <div key={a.id} className="flex justify-between rounded-xl border border-border/60 bg-muted/30 p-3 text-sm transition-colors hover:bg-muted/50">
                <span><strong>{a.userName}</strong> — {a.action}</span>
                <span className="text-muted-foreground">{format(a.timestamp, "MMM d, h:mm a")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
