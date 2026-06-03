import { doc, getDoc, setDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS, SETTINGS_DOC_ID } from "@/lib/constants";
import { stripUndefined } from "@/lib/firebase/converters";
import { DEFAULT_AUTOMATION, type AppSettings } from "@/types";

const DEFAULT_SETTINGS: Omit<AppSettings, "id"> = {
  companyName: "Nightingale Recruit",
  fromEmail: "noreply@nightingale.com",
  smtp: {
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
  },
  automation: DEFAULT_AUTOMATION,
};

export async function getSettings(): Promise<AppSettings> {
  const db = getClientDb();
  const snap = await getDoc(doc(db, COLLECTIONS.settings, SETTINGS_DOC_ID));
  if (!snap.exists()) {
    return { id: SETTINGS_DOC_ID, ...DEFAULT_SETTINGS };
  }
  const data = snap.data();
  return {
    id: SETTINGS_DOC_ID,
    companyName: data.companyName ?? DEFAULT_SETTINGS.companyName,
    logoUrl: data.logoUrl,
    fromEmail: data.fromEmail ?? DEFAULT_SETTINGS.fromEmail,
    smtp: data.smtp ?? DEFAULT_SETTINGS.smtp,
    defaultTemplateId: data.defaultTemplateId,
    automation: { ...DEFAULT_AUTOMATION, ...(data.automation ?? {}) },
  };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  const db = getClientDb();
  const { id: _omitId, ...rest } = settings;
  void _omitId;
  await setDoc(
    doc(db, COLLECTIONS.settings, SETTINGS_DOC_ID),
    stripUndefined(rest as Record<string, unknown>),
    { merge: true }
  );
}
