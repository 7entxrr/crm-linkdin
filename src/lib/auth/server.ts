import { NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";
import type { UserRole } from "@/types";

export interface AuthContext {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
}

export async function verifyAuthToken(
  request: NextRequest
): Promise<AuthContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const snap = await getAdminDb().collection(COLLECTIONS.users).doc(decoded.uid).get();
    const data = snap.data();
    const role = (data?.role as UserRole) ?? "recruiter";
    return {
      uid: decoded.uid,
      email: decoded.email ?? (data?.email as string) ?? "",
      role,
      name: (data?.name as string) ?? decoded.email ?? "User",
    };
  } catch {
    return null;
  }
}

export function requireAdmin(auth: AuthContext | null): auth is AuthContext {
  return auth !== null && auth.role === "admin";
}
