import type { Candidate, Outreach, AppUser } from "@/types";

export function computeDashboardStats(
  candidates: Candidate[],
  recruiters: AppUser[],
  outreachs: Outreach[]
) {
  const totalCandidates = candidates.length;
  const totalRecruiters = recruiters.filter((r) => r.status === "active").length;
  const totalOutreach = outreachs.length;
  const sentOutreachs = outreachs.filter((o) => o.status === "sent" || o.status === "replied");
  const sent = sentOutreachs.length;
  const replied = candidates.filter((c) =>
    ["replied", "interested", "interview_scheduled"].includes(c.status)
  ).length;
  const responseRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
  const interestedCandidates = candidates.filter((c) => c.status === "interested").length;

  const opened = sentOutreachs.filter((o) => (o.opens ?? 0) > 0).length;
  const clicked = sentOutreachs.filter((o) => (o.clicks ?? 0) > 0).length;
  const outreachReplied = sentOutreachs.filter((o) => o.status === "replied").length;
  const openRate = sent > 0 ? Math.round((opened / sent) * 100) : 0;
  const clickRate = sent > 0 ? Math.round((clicked / sent) * 100) : 0;
  const replyRate = sent > 0 ? Math.round((outreachReplied / sent) * 100) : 0;
  const unsubscribeCount = candidates.filter((c) => c.optedOut).length;
  const bouncedCount = candidates.filter((c) => c.emailBounced).length;

  return {
    totalCandidates,
    totalRecruiters,
    totalOutreach,
    responseRate,
    interestedCandidates,
    openRate,
    clickRate,
    replyRate,
    unsubscribeCount,
    bouncedCount,
  };
}

export function candidatesByRole(candidates: Candidate[]) {
  const map = new Map<string, number>();
  candidates.forEach((c) => {
    map.set(c.role, (map.get(c.role) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

export function candidatesByState(candidates: Candidate[]) {
  const map = new Map<string, number>();
  candidates.forEach((c) => {
    map.set(c.state, (map.get(c.state) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export function recruiterPerformance(
  candidates: Candidate[],
  recruiters: AppUser[]
) {
  return recruiters.map((r) => {
    const assigned = candidates.filter((c) => c.assignedRecruiterId === r.id);
    const replied = assigned.filter((c) =>
      ["replied", "interested", "interview_scheduled"].includes(c.status)
    ).length;
    const rate = assigned.length > 0 ? Math.round((replied / assigned.length) * 100) : 0;
    return { name: r.name.split(" ")[0], assigned: assigned.length, rate };
  });
}

export function recruiterLeaderboard(
  candidates: Candidate[],
  outreachs: Outreach[],
  recruiters: AppUser[]
) {
  return recruiters
    .filter((r) => r.status === "active")
    .map((r) => {
      const assigned = candidates.filter((c) => c.assignedRecruiterId === r.id);
      const myOutreach = outreachs.filter((o) => o.recruiterId === r.id);
      const sent = myOutreach.filter((o) => o.status === "sent" || o.status === "replied");
      const opened = sent.filter((o) => (o.opens ?? 0) > 0).length;
      const replied = assigned.filter((c) =>
        ["replied", "interested", "interview_scheduled"].includes(c.status)
      ).length;
      const interested = assigned.filter((c) => c.status === "interested").length;
      return {
        id: r.id,
        name: r.name,
        assigned: assigned.length,
        sent: sent.length,
        openRate: sent.length > 0 ? Math.round((opened / sent.length) * 100) : 0,
        replyRate: assigned.length > 0 ? Math.round((replied / assigned.length) * 100) : 0,
        interested,
      };
    })
    .sort((a, b) => b.interested - a.interested || b.replyRate - a.replyRate);
}

export function responseTrends(outreachs: Outreach[]) {
  const map = new Map<string, { sent: number; month: string }>();
  outreachs.forEach((o) => {
    const d = o.sentAt ?? o.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = map.get(key) ?? { sent: 0, month: key };
    existing.sent++;
    map.set(key, existing);
  });
  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6)
    .map((v) => ({ month: v.month, sent: v.sent }));
}

export function engagementTrends(outreachs: Outreach[]) {
  const map = new Map<
    string,
    { month: string; sent: number; opened: number; clicked: number; replied: number }
  >();
  outreachs.forEach((o) => {
    const d = o.sentAt ?? o.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const existing = map.get(key) ?? {
      month: key,
      sent: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
    };
    if (o.status === "sent" || o.status === "replied") {
      existing.sent++;
      if ((o.opens ?? 0) > 0) existing.opened++;
      if ((o.clicks ?? 0) > 0) existing.clicked++;
      if (o.status === "replied") existing.replied++;
    }
    map.set(key, existing);
  });
  return Array.from(map.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);
}
