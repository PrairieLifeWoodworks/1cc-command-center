import { randomUUID } from "node:crypto";

import type { DbClient } from "./client";
import {
  type BranchRecord,
  type SmartMovingConnectionRecord,
  type TenantRecord
} from "./repositories";
import { branch, smartmovingConnection, tenant } from "./schema";

export interface UpsertTenantInput {
  slug: string;
  name: string;
  timezoneDefault: string;
  status: string;
}

export interface UpsertBranchInput {
  tenantId: string;
  slug: string;
  name: string;
  timezone: string;
  status: string;
}

export interface UpsertSmartMovingConnectionInput {
  branchId: string;
  apiBaseUrl: string;
  apiKeySecretRef: string;
  webhookSecretRef: string;
  onboardingStatus: string;
}

export async function upsertTenant(
  db: DbClient,
  input: UpsertTenantInput
): Promise<TenantRecord> {
  const updatedAt = new Date();
  const [tenantRecord] = await db
    .insert(tenant)
    .values({
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      timezoneDefault: input.timezoneDefault,
      status: input.status,
      updatedAt
    })
    .onConflictDoUpdate({
      target: tenant.slug,
      set: {
        name: input.name,
        timezoneDefault: input.timezoneDefault,
        status: input.status,
        updatedAt
      }
    })
    .returning();

  return tenantRecord;
}

export async function upsertBranch(
  db: DbClient,
  input: UpsertBranchInput
): Promise<BranchRecord> {
  const updatedAt = new Date();
  const [branchRecord] = await db
    .insert(branch)
    .values({
      id: randomUUID(),
      tenantId: input.tenantId,
      slug: input.slug,
      name: input.name,
      timezone: input.timezone,
      status: input.status,
      updatedAt
    })
    .onConflictDoUpdate({
      target: [branch.tenantId, branch.slug],
      set: {
        name: input.name,
        timezone: input.timezone,
        status: input.status,
        updatedAt
      }
    })
    .returning();

  return branchRecord;
}

export async function upsertSmartMovingConnection(
  db: DbClient,
  input: UpsertSmartMovingConnectionInput
): Promise<SmartMovingConnectionRecord> {
  const updatedAt = new Date();
  const [connectionRecord] = await db
    .insert(smartmovingConnection)
    .values({
      id: randomUUID(),
      branchId: input.branchId,
      apiBaseUrl: input.apiBaseUrl,
      apiKeySecretRef: input.apiKeySecretRef,
      webhookSecretRef: input.webhookSecretRef,
      onboardingStatus: input.onboardingStatus,
      updatedAt
    })
    .onConflictDoUpdate({
      target: smartmovingConnection.branchId,
      set: {
        apiBaseUrl: input.apiBaseUrl,
        apiKeySecretRef: input.apiKeySecretRef,
        webhookSecretRef: input.webhookSecretRef,
        onboardingStatus: input.onboardingStatus,
        updatedAt
      }
    })
    .returning();

  return connectionRecord;
}
