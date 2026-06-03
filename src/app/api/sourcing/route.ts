import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyAuthToken, requireAdmin } from "@/lib/auth/server";
import { COLLECTIONS } from "@/lib/constants";

interface RulePayload {
  id?: string;
  name?: string;
  personTitles?: string[];
  locations?: string[];
  organizationDomains?: string[];
  perRun?: number;
  enabled?: boolean;
  autoEnroll?: boolean;
  assignedRecruiterId?: string;
  assignedRecruiterName?: string;
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!requireAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as RulePayload;
  if (!body.name || !body.personTitles?.length) {
    return NextResponse.json(
      { error: "Name and at least one job title are required" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const ref = await db.collection(COLLECTIONS.sourcingRules).add({
    name: body.name,
    personTitles: body.personTitles,
    locations: body.locations ?? [],
    organizationDomains: body.organizationDomains ?? [],
    perRun: Math.min(Math.max(body.perRun ?? 10, 1), 50),
    enabled: body.enabled ?? true,
    autoEnroll: body.autoEnroll ?? false,
    assignedRecruiterId: body.assignedRecruiterId ?? null,
    assignedRecruiterName: body.assignedRecruiterName ?? null,
    totalImported: 0,
    createdBy: auth!.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ id: ref.id });
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!requireAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as RulePayload;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.personTitles !== undefined) updates.personTitles = body.personTitles;
  if (body.locations !== undefined) updates.locations = body.locations;
  if (body.organizationDomains !== undefined)
    updates.organizationDomains = body.organizationDomains;
  if (body.perRun !== undefined)
    updates.perRun = Math.min(Math.max(body.perRun, 1), 50);
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.autoEnroll !== undefined) updates.autoEnroll = body.autoEnroll;
  if (body.assignedRecruiterId !== undefined)
    updates.assignedRecruiterId = body.assignedRecruiterId || null;
  if (body.assignedRecruiterName !== undefined)
    updates.assignedRecruiterName = body.assignedRecruiterName || null;

  await getAdminDb().collection(COLLECTIONS.sourcingRules).doc(body.id).update(updates);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuthToken(request);
  if (!requireAdmin(auth)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = (await request.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await getAdminDb().collection(COLLECTIONS.sourcingRules).doc(id).delete();
  return NextResponse.json({ success: true });
}
