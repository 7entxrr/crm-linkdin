import {
  LayoutDashboard,
  Users,
  UserCog,
  Mail,
  CalendarClock,
  BarChart3,
  Activity,
  Settings,
  StickyNote,
  User,
  Search,
  Radar,
  Columns3,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "recruiter"] },
  { title: "Find Prospects", href: "/prospects", icon: Search, roles: ["admin", "recruiter"] },
  { title: "Auto-Sourcing", href: "/sourcing", icon: Radar, roles: ["admin"] },
  { title: "Candidates", href: "/candidates", icon: Users, roles: ["admin"] },
  { title: "My Candidates", href: "/candidates", icon: Users, roles: ["recruiter"] },
  { title: "Pipeline", href: "/pipeline", icon: Columns3, roles: ["admin", "recruiter"] },
  { title: "Recruiters", href: "/recruiters", icon: UserCog, roles: ["admin"] },
  { title: "Outreach", href: "/outreach", icon: Mail, roles: ["admin", "recruiter"] },
  { title: "Followups", href: "/followups", icon: CalendarClock, roles: ["admin", "recruiter"] },
  { title: "Analytics", href: "/analytics", icon: BarChart3, roles: ["admin"] },
  { title: "Activity Logs", href: "/activity", icon: Activity, roles: ["admin"] },
  { title: "Notes", href: "/notes", icon: StickyNote, roles: ["recruiter"] },
  { title: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
  { title: "Profile", href: "/profile", icon: User, roles: ["recruiter"] },
];

export function getNavForRole(role: UserRole): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role));
}
