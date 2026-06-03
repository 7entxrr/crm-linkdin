"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CardGridSkeleton } from "@/components/shared/loading-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCog, Mail, TrendingUp, Heart, Eye, MousePointerClick, MessageSquare, Ban } from "lucide-react";
import { getCandidates } from "@/lib/services/candidates";
import { getRecruiters } from "@/lib/services/users";
import { getOutreachs } from "@/lib/services/outreachs";
import {
  computeDashboardStats,
  candidatesByRole,
  candidatesByState,
  responseTrends,
  recruiterPerformance,
  engagementTrends,
  recruiterLeaderboard,
} from "@/lib/analytics";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReturnType<typeof computeDashboardStats> | null>(null);
  const [byRole, setByRole] = useState<{ name: string; value: number }[]>([]);
  const [byState, setByState] = useState<{ name: string; value: number }[]>([]);
  const [trends, setTrends] = useState<{ month: string; sent: number }[]>([]);
  const [recruiters, setRecruiters] = useState<{ name: string; assigned: number; rate: number }[]>([]);
  const [engagement, setEngagement] = useState<
    { month: string; sent: number; opened: number; clicked: number; replied: number }[]
  >([]);
  const [leaderboard, setLeaderboard] = useState<
    ReturnType<typeof recruiterLeaderboard>
  >([]);

  useEffect(() => {
    async function load() {
      const [candidates, recruiterList, outreachs] = await Promise.all([
        getCandidates(),
        getRecruiters(),
        getOutreachs(),
      ]);
      setStats(computeDashboardStats(candidates, recruiterList, outreachs));
      setByRole(candidatesByRole(candidates));
      setByState(candidatesByState(candidates));
      setTrends(responseTrends(outreachs));
      setRecruiters(recruiterPerformance(candidates, recruiterList));
      setEngagement(engagementTrends(outreachs));
      setLeaderboard(recruiterLeaderboard(candidates, outreachs, recruiterList));
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" />
        <CardGridSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" description="Recruitment performance insights" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Total Candidates" value={stats.totalCandidates} icon={Users} index={0} />
        <StatCard title="Recruiters" value={stats.totalRecruiters} icon={UserCog} index={1} />
        <StatCard title="Outreach" value={stats.totalOutreach} icon={Mail} index={2} />
        <StatCard title="Response Rate" value={`${stats.responseRate}%`} icon={TrendingUp} index={3} />
        <StatCard title="Open Rate" value={`${stats.openRate}%`} icon={Eye} index={4} />
        <StatCard title="Click Rate" value={`${stats.clickRate}%`} icon={MousePointerClick} index={5} />
        <StatCard title="Reply Rate" value={`${stats.replyRate}%`} icon={MessageSquare} index={6} />
        <StatCard title="Interested" value={stats.interestedCandidates} icon={Heart} index={7} />
        <StatCard title="Unsubscribed" value={stats.unsubscribeCount} icon={Ban} index={8} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Candidates by Role</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byRole}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Candidates by State</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byState}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Response Trends</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sent" stroke="#0d9488" strokeWidth={2} dot={{ fill: "#0d9488" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Engagement Trends</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagement}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sent" stroke="#0d9488" strokeWidth={2} name="Sent" />
                <Line type="monotone" dataKey="opened" stroke="#3b82f6" strokeWidth={2} name="Opened" />
                <Line type="monotone" dataKey="clicked" stroke="#8b5cf6" strokeWidth={2} name="Clicked" />
                <Line type="monotone" dataKey="replied" stroke="#10b981" strokeWidth={2} name="Replied" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recruiter Performance</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recruiters}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="rate" fill="#0d9488" name="Response %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="assigned" fill="#99f6e4" name="Assigned" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recruiter Leaderboard</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Recruiter</th>
                  <th className="pb-2 pr-4">Assigned</th>
                  <th className="pb-2 pr-4">Sent</th>
                  <th className="pb-2 pr-4">Open %</th>
                  <th className="pb-2 pr-4">Reply %</th>
                  <th className="pb-2">Interested</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-4 font-medium">
                      <span className="text-muted-foreground mr-2">#{i + 1}</span>
                      {r.name}
                    </td>
                    <td className="py-2.5 pr-4">{r.assigned}</td>
                    <td className="py-2.5 pr-4">{r.sent}</td>
                    <td className="py-2.5 pr-4">{r.openRate}%</td>
                    <td className="py-2.5 pr-4">{r.replyRate}%</td>
                    <td className="py-2.5">{r.interested}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
