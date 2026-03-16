import { randomUUID } from "node:crypto";

import { and, desc, eq, gte, lte } from "drizzle-orm";

import type { DbClient } from "./client";
import {
  branch,
  hydratedOpportunitySnapshot,
  normalizedEvent,
  rawWebhookEvent,
  smartmovingConnection,
  tenant
} from "./schema";

export type TenantRecord = typeof tenant.$inferSelect;
export type BranchRecord = typeof branch.$inferSelect;
export type SmartMovingConnectionRecord = typeof smartmovingConnection.$inferSelect;
export type RawWebhookEventRecord = typeof rawWebhookEvent.$inferSelect;
export type NormalizedEventRecord = typeof normalizedEvent.$inferSelect;
export type HydratedOpportunitySnapshotRecord =
  typeof hydratedOpportunitySnapshot.$inferSelect;

export interface InsertRawWebhookEventInput {
  tenantId: string;
  branchId: string;
  source: string;
  receivedAt?: Date;
  headersJson: Record<string, string | string[]>;
  payloadJson: unknown;
  payloadHash: string;
  authResult: string;
}

export interface InsertNormalizedEventInput {
  rawEventId: string;
  tenantId: string;
  branchId: string;
  receivedAt: Date;
  rawEventType: string;
  normalizedEventClass: string;
  entityType: string;
  entityId: string | null;
  statusCodeRaw: string | null;
  dedupeKey: string;
  duplicate: boolean;
  normalizationVersion: string;
}

export interface InsertHydratedOpportunitySnapshotInput {
  normalizedEventId: string;
  rawEventId: string;
  tenantId: string;
  branchId: string;
  opportunityId: string;
  fetchedAt?: Date;
  opportunityJson: unknown;
  auditActivityJson: unknown | null;
  followupsJson: unknown | null;
  snapshotVersion: string;
}

export async function findTenantBySlug(
  db: DbClient,
  slug: string
): Promise<TenantRecord | null> {
  const [tenantRecord] = await db
    .select()
    .from(tenant)
    .where(eq(tenant.slug, slug))
    .limit(1);

  return tenantRecord ?? null;
}

export async function findBranchByTenantAndSlug(
  db: DbClient,
  tenantId: string,
  slug: string
): Promise<BranchRecord | null> {
  const [branchRecord] = await db
    .select()
    .from(branch)
    .where(and(eq(branch.tenantId, tenantId), eq(branch.slug, slug)))
    .limit(1);

  return branchRecord ?? null;
}

export async function findSmartMovingConnectionByBranchId(
  db: DbClient,
  branchId: string
): Promise<SmartMovingConnectionRecord | null> {
  const [connectionRecord] = await db
    .select()
    .from(smartmovingConnection)
    .where(eq(smartmovingConnection.branchId, branchId))
    .limit(1);

  return connectionRecord ?? null;
}

export async function insertRawWebhookEvent(
  db: DbClient,
  input: InsertRawWebhookEventInput
): Promise<Pick<RawWebhookEventRecord, "id" | "authResult" | "receivedAt">> {
  const [rawWebhookEventRecord] = await db
    .insert(rawWebhookEvent)
    .values({
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      source: input.source,
      receivedAt: input.receivedAt ?? new Date(),
      headersJson: input.headersJson,
      payloadJson: input.payloadJson,
      payloadHash: input.payloadHash,
      authResult: input.authResult
    })
    .returning({
      id: rawWebhookEvent.id,
      authResult: rawWebhookEvent.authResult,
      receivedAt: rawWebhookEvent.receivedAt
    });

  return rawWebhookEventRecord;
}

export async function findRawWebhookEventById(
  db: DbClient,
  id: string
): Promise<RawWebhookEventRecord | null> {
  const [rawWebhookEventRecord] = await db
    .select()
    .from(rawWebhookEvent)
    .where(eq(rawWebhookEvent.id, id))
    .limit(1);

  return rawWebhookEventRecord ?? null;
}

export async function findNormalizedEventByRawEventId(
  db: DbClient,
  rawEventId: string
): Promise<NormalizedEventRecord | null> {
  const [normalizedEventRecord] = await db
    .select()
    .from(normalizedEvent)
    .where(eq(normalizedEvent.rawEventId, rawEventId))
    .limit(1);

  return normalizedEventRecord ?? null;
}

export async function findNormalizedEventById(
  db: DbClient,
  normalizedEventId: string
): Promise<NormalizedEventRecord | null> {
  const [normalizedEventRecord] = await db
    .select()
    .from(normalizedEvent)
    .where(eq(normalizedEvent.id, normalizedEventId))
    .limit(1);

  return normalizedEventRecord ?? null;
}

export async function findRecentNormalizedEventByDedupeKey(
  db: DbClient,
  dedupeKey: string,
  receivedAtFloor: Date,
  receivedAtCeiling: Date
): Promise<NormalizedEventRecord | null> {
  const [normalizedEventRecord] = await db
    .select()
    .from(normalizedEvent)
    .where(
      and(
        eq(normalizedEvent.dedupeKey, dedupeKey),
        gte(normalizedEvent.receivedAt, receivedAtFloor),
        lte(normalizedEvent.receivedAt, receivedAtCeiling)
      )
    )
    .orderBy(desc(normalizedEvent.receivedAt))
    .limit(1);

  return normalizedEventRecord ?? null;
}

export async function insertNormalizedEvent(
  db: DbClient,
  input: InsertNormalizedEventInput
): Promise<{ record: NormalizedEventRecord; inserted: boolean }> {
  const [normalizedEventRecord] = await db
    .insert(normalizedEvent)
    .values({
      id: randomUUID(),
      rawEventId: input.rawEventId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      receivedAt: input.receivedAt,
      rawEventType: input.rawEventType,
      normalizedEventClass: input.normalizedEventClass,
      entityType: input.entityType,
      entityId: input.entityId,
      statusCodeRaw: input.statusCodeRaw,
      dedupeKey: input.dedupeKey,
      duplicate: input.duplicate,
      normalizationVersion: input.normalizationVersion
    })
    .onConflictDoNothing({
      target: normalizedEvent.rawEventId
    })
    .returning();

  if (normalizedEventRecord) {
    return {
      record: normalizedEventRecord,
      inserted: true
    };
  }

  const existingRecord = await findNormalizedEventByRawEventId(db, input.rawEventId);

  if (!existingRecord) {
    throw new Error(
      `Failed to insert or reload normalized event for raw event '${input.rawEventId}'.`
    );
  }

  return {
    record: existingRecord,
    inserted: false
  };
}

export async function findHydratedOpportunitySnapshotByNormalizedEventId(
  db: DbClient,
  normalizedEventId: string
): Promise<HydratedOpportunitySnapshotRecord | null> {
  const [snapshotRecord] = await db
    .select()
    .from(hydratedOpportunitySnapshot)
    .where(eq(hydratedOpportunitySnapshot.normalizedEventId, normalizedEventId))
    .limit(1);

  return snapshotRecord ?? null;
}

export async function insertHydratedOpportunitySnapshot(
  db: DbClient,
  input: InsertHydratedOpportunitySnapshotInput
): Promise<{ record: HydratedOpportunitySnapshotRecord; inserted: boolean }> {
  const [snapshotRecord] = await db
    .insert(hydratedOpportunitySnapshot)
    .values({
      id: randomUUID(),
      normalizedEventId: input.normalizedEventId,
      rawEventId: input.rawEventId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      opportunityId: input.opportunityId,
      fetchedAt: input.fetchedAt ?? new Date(),
      opportunityJson: input.opportunityJson,
      auditActivityJson: input.auditActivityJson,
      followupsJson: input.followupsJson,
      snapshotVersion: input.snapshotVersion
    })
    .onConflictDoNothing({
      target: hydratedOpportunitySnapshot.normalizedEventId
    })
    .returning();

  if (snapshotRecord) {
    return {
      record: snapshotRecord,
      inserted: true
    };
  }

  const existingRecord = await findHydratedOpportunitySnapshotByNormalizedEventId(
    db,
    input.normalizedEventId
  );

  if (!existingRecord) {
    throw new Error(
      `Failed to insert or reload hydrated opportunity snapshot for normalized event '${input.normalizedEventId}'.`
    );
  }

  return {
    record: existingRecord,
    inserted: false
  };
}
