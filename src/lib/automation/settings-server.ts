import { getAdminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, SETTINGS_DOC_ID } from "@/lib/constants";
import { DEFAULT_AUTOMATION, type AutomationSettings } from "@/types";

export interface ServerSettings {
  companyName: string;
  fromEmail?: string;
  smtp?: { host: string; port: number; secure: boolean; user: string; pass: string };
  automation: AutomationSettings;
}

/** Reads app settings (with automation defaults applied) from Firestore admin. */
export async function getServerSettings(): Promise<ServerSettings> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID).get();
  const data = snap.data() ?? {};
  return {
    companyName: data.companyName ?? "Nightingale Recruit",
    fromEmail: data.fromEmail,
    smtp: data.smtp,
    automation: { ...DEFAULT_AUTOMATION, ...(data.automation ?? {}) },
  };
}

/** True if the current server-local time is within the configured send window. */
export function isWithinSendWindow(a: AutomationSettings, now = new Date()): boolean {
  if (!a.businessHoursOnly) return true;
  const hour = now.getHours();
  const { sendStartHour: start, sendEndHour: end } = a;
  if (start <= end) return hour >= start && hour < end;
  // Window wraps past midnight.
  return hour >= start || hour < end;
}
