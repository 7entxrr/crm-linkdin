import type { UserRole } from "@/types";

export const ADMIN_ROUTES = [
  "/recruiters",
  "/analytics",
  "/activity",
  "/settings",
  "/sourcing",
];

export function canAccessRoute(role: UserRole | null, path: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  return !ADMIN_ROUTES.some((r) => path.startsWith(r));
}

export function isAdmin(role: UserRole | null): boolean {
  return role === "admin";
}
