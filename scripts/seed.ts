import { config } from "dotenv";
import { resolve } from "path";
import { FieldValue } from "firebase-admin/firestore";

config({ path: resolve(process.cwd(), ".env.local") });

async function seed() {
  const { getAdminAuth, getAdminDb } = await import("../src/lib/firebase/admin");
  const { COLLECTIONS, SETTINGS_DOC_ID } = await import("../src/lib/constants");

  const auth = getAdminAuth();
  const db = getAdminDb();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@nightingale.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123!";
  const recruiter1Email = process.env.SEED_RECRUITER1_EMAIL ?? "recruiter1@nightingale.com";
  const recruiter2Email = process.env.SEED_RECRUITER2_EMAIL ?? "recruiter2@nightingale.com";
  const recruiterPassword = process.env.SEED_RECRUITER_PASSWORD ?? "Recruit123!";
  const clearMock = process.env.SEED_CLEAR_MOCK_CANDIDATES === "true";

  async function ensureUser(email: string, password: string, name: string, role: "admin" | "recruiter") {
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      console.log(`User exists: ${email}`);
    } catch {
      const created = await auth.createUser({ email, password, displayName: name });
      uid = created.uid;
      console.log(`Created user: ${email}`);
    }
    await db.collection(COLLECTIONS.users).doc(uid).set({
      email,
      name,
      role,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return uid;
  }

  const adminId = await ensureUser(adminEmail, adminPassword, "Admin User", "admin");

  if (process.env.SEED_DEMO_RECRUITERS === "true") {
    await ensureUser(recruiter1Email, recruiterPassword, "Sarah Johnson", "recruiter");
    await ensureUser(recruiter2Email, recruiterPassword, "Michael Chen", "recruiter");
  }

  await db.collection(COLLECTIONS.settings).doc(SETTINGS_DOC_ID).set({
    companyName: "Nightingale Recruit",
    fromEmail: "noreply@nightingale.com",
    smtp: {
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      user: "",
      pass: "",
    },
  }, { merge: true });

  const existingTemplates = await db.collection(COLLECTIONS.templates).limit(1).get();
  let templateId = existingTemplates.docs[0]?.id;

  if (!templateId) {
    const templateRef = await db.collection(COLLECTIONS.templates).add({
      name: "Initial Outreach",
      subject: "Healthcare opportunity for {{firstName}} — {{role}}",
      body: `Hi {{firstName}},\n\nI came across your profile and wanted to reach out about an exciting {{role}} opportunity in {{location}}.\n\nWould you be open to a brief conversation?\n\nBest regards,\nNightingale Recruit Team`,
      createdBy: adminId,
      createdAt: FieldValue.serverTimestamp(),
    });
    templateId = templateRef.id;
    console.log(`Created default template: ${templateId}`);
  }

  if (clearMock) {
    const candidatesSnap = await db.collection(COLLECTIONS.candidates).get();
    let deleted = 0;
    const batch = db.batch();
    for (const doc of candidatesSnap.docs) {
      const source = doc.data().source;
      const apolloId = doc.data().apolloId;
      if (source !== "apollo" || !apolloId) {
        batch.delete(doc.ref);
        deleted++;
      }
    }
    if (deleted > 0) {
      await batch.commit();
      console.log(`Removed ${deleted} mock/legacy candidates`);
    }
  }

  await db.collection(COLLECTIONS.activities).add({
    userId: adminId,
    userName: "Admin User",
    action: "Database seeded (users + settings only)",
    entityType: "system",
    entityId: "seed",
    timestamp: FieldValue.serverTimestamp(),
  });

  console.log("\nSeed complete!");
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  if (process.env.SEED_DEMO_RECRUITERS === "true") {
    console.log(`Recruiter 1: ${recruiter1Email} / ${recruiterPassword}`);
    console.log(`Recruiter 2: ${recruiter2Email} / ${recruiterPassword}`);
  } else {
    console.log("Recruiters: add your own via the Recruiters page (set SEED_DEMO_RECRUITERS=true for demo accounts).");
  }
  console.log("\nCandidates are imported via Find Prospects (Apollo.io), not seed data.");
  if (!clearMock) {
    console.log("Tip: set SEED_CLEAR_MOCK_CANDIDATES=true to remove old mock candidates.");
  }
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
