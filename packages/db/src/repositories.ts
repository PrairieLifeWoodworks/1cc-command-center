import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import type { DbClient } from "./client";
import { branch, rawWebhookEvent, smartmovingConnection, tenant } from "./schema";

export type TenantRecord = typeof tenant.$inferSelect;
export type BranchRecord = typeof branch.$inferSelect;
export type SmartMovingConnectionRecord = typeof smartmovingConnection.$inferSelect;
export type RawWebhookEventRecord = typeof rawWebhookEvent.$inferSelect;

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
