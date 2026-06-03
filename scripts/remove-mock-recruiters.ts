import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function removeMockRecruiters() {
  const { getAdminAuth, getAdminDb } = await import("../src/lib/firebase/admin");
  const { COLLECTIONS } = await import("../src/lib/constants");

  const auth = getAdminAuth();
  const db = getAdminDb();

  const emails = [
    process.env.SEED_RECRUITER1_EMAIL ?? "recruiter1@nightingale.com",
    process.env.SEED_RECRUITER2_EMAIL ?? "recruiter2@nightingale.com",
  ];

  for (const email of emails) {
    try {
      const user = await auth.getUserByEmail(email);

      const assigned = await db
        .collection(COLLECTIONS.candidates)
        .where("assignedRecruiterId", "==", user.uid)
        .get();
      if (!assigned.empty) {
        const { FieldValue } = await import("firebase-admin/firestore");
        const batch = db.batch();
        assigned.forEach((doc) =>
          batch.update(doc.ref, {
            assignedRecruiterId: FieldValue.delete(),
            assignedRecruiterName: FieldValue.delete(),
          })
        );
        await batch.commit();
        console.log(`Unassigned ${assigned.size} candidate(s) from ${email}`);
      }

      await db.collection(COLLECTIONS.users).doc(user.uid).delete();
      await auth.deleteUser(user.uid);
      console.log(`Removed ${email}`);
    } catch {
      console.log(`Skip ${email} (not found)`);
    }
  }

  console.log("\nDone. Add your own recruiters from the Recruiters page.");
}

removeMockRecruiters().catch((err) => {
  console.error(err);
  process.exit(1);
});
