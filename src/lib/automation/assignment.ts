import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/constants";

export interface RecruiterRef {
  id: string;
  name: string;
}

/**
 * Picks the least-loaded active recruiter (by current candidate count) so new
 * candidates are distributed evenly. Returns null if there are no recruiters.
 *
 * Pass `pendingCounts` to account for candidates assigned earlier in the same
 * batch that haven't been written yet.
 */
export async function pickRecruiterRoundRobin(
  pendingCounts: Record<string, number> = {}
): Promise<RecruiterRef | null> {
  const db = getAdminDb();

  const usersSnap = await db
    .collection(COLLECTIONS.users)
    .where("role", "==", "recruiter")
    .where("status", "==", "active")
    .get();

  if (usersSnap.empty) return null;

  const recruiters = usersSnap.docs.map((d) => ({
    id: d.id,
    name: (d.data().name as string) ?? "Recruiter",
  }));

  let best: RecruiterRef | null = null;
  let bestLoad = Infinity;

  for (const r of recruiters) {
    const countSnap = await db
      .collection(COLLECTIONS.candidates)
      .where("assignedRecruiterId", "==", r.id)
      .count()
      .get();
    const load = countSnap.data().count + (pendingCounts[r.id] ?? 0);
    if (load < bestLoad) {
      bestLoad = load;
      best = r;
    }
  }

  return best;
}
