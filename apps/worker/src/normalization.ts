import { createHash } from "node:crypto";

import type {
  NormalizedEventClass,
  SmartMovingNormalizedEventHydrateJobPayload,
  SmartMovingEntityType,
  SmartMovingRawWebhookNormalizeJobPayload
} from "@1cc/contracts";
import type { NormalizedEventRecord, RawWebhookEventRecord } from "@1cc/db";

export const NORMALIZATION_VERSION = "smartmoving_raw_v1";
export const DEDUPE_WINDOW_SECONDS = 120;

export interface NormalizationRepository {
  findRawWebhookEventById(rawEventId: string): Promise<RawWebhookEventRecord | null>;
  findRecentNormalizedEventByDedupeKey(
    dedupeKey: string,
    receivedAtFloor: Date,
    receivedAtCeiling: Date
  ): Promise<NormalizedEventRecord | null>;
  insertNormalizedEvent(input: {
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
  }): Promise<{ record: NormalizedEventRecord; inserted: boolean }>;
}

export interface NormalizationResult {
  rawEventId: string;
  normalizedEventId: string;
  tenantId: string;
  branchId: string;
  entityType: SmartMovingEntityType;
  entityId: string | null;
  inserted: boolean;
  duplicate: boolean;
  dedupeKey: string;
  normalizedEventClass: NormalizedEventClass;
  rawEventType: string;
}

export function buildHydrationJobPayloadFromNormalization(
  result: NormalizationResult
): SmartMovingNormalizedEventHydrateJobPayload | null {
  if (
    result.duplicate ||
    result.entityType !== "opportunity" ||
    !result.entityId
  ) {
    return null;
  }

  return {
    normalizedEventId: result.normalizedEventId,
    rawEventId: result.rawEventId,
    tenantId: result.tenantId,
    branchId: result.branchId,
    opportunityId: result.entityId
  };
}

type SmartMovingPayload = Record<string, unknown>;

function asPayloadRecord(payload: unknown): SmartMovingPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload as SmartMovingPayload;
}

function readStringField(
  payload: SmartMovingPayload,
  key: string
): string | undefined {
  const value = payload[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

export function mapNormalizedEventClass(
  rawEventType: string
): NormalizedEventClass {
  switch (rawEventType) {
    case "opportunity-created":
      return "opportunity_created";
    case "opportunity-changed":
      return "opportunity_updated";
    case "opportunity-status-changed":
      return "opportunity_status_changed";
    default:
      return "unknown";
  }
}

export function buildDedupeKey(input: {
  tenantId: string;
  branchId: string;
  rawEventType: string;
  entityType: SmartMovingEntityType;
  entityId: string | null;
  statusCodeRaw: string | null;
  payloadHash: string;
}): string {
  const dedupeSource = [
    input.tenantId,
    input.branchId,
    input.rawEventType,
    input.entityType,
    input.entityId ?? "",
    input.statusCodeRaw ?? "",
    input.payloadHash
  ].join("|");

  return createHash("sha256").update(dedupeSource).digest("hex");
}

export function deriveNormalizedEvent(rawEvent: RawWebhookEventRecord): {
  tenantId: string;
  branchId: string;
  receivedAt: Date;
  rawEventType: string;
  normalizedEventClass: NormalizedEventClass;
  entityType: SmartMovingEntityType;
  entityId: string | null;
  statusCodeRaw: string | null;
  dedupeKey: string;
} {
  const payload = asPayloadRecord(rawEvent.payloadJson);
  const rawEventType = readStringField(payload, "event-type") ?? "unknown";
  const entityId = readStringField(payload, "opportunity-id") ?? null;
  const statusCodeRaw = readStringField(payload, "opportunity-status") ?? null;
  const entityType: SmartMovingEntityType = entityId ? "opportunity" : "unknown";

  return {
    tenantId: rawEvent.tenantId,
    branchId: rawEvent.branchId,
    receivedAt: rawEvent.receivedAt,
    rawEventType,
    normalizedEventClass: mapNormalizedEventClass(rawEventType),
    entityType,
    entityId,
    statusCodeRaw,
    dedupeKey: buildDedupeKey({
      tenantId: rawEvent.tenantId,
      branchId: rawEvent.branchId,
      rawEventType,
      entityType,
      entityId,
      statusCodeRaw,
      payloadHash: rawEvent.payloadHash
    })
  };
}

export async function normalizeAcceptedRawWebhookEvent(
  repository: NormalizationRepository,
  job: SmartMovingRawWebhookNormalizeJobPayload
): Promise<NormalizationResult> {
  const rawEvent = await repository.findRawWebhookEventById(job.rawEventId);

  if (!rawEvent) {
    throw new Error(`Raw webhook event '${job.rawEventId}' was not found.`);
  }

  const normalized = deriveNormalizedEvent(rawEvent);
  const receivedAtFloor = new Date(
    normalized.receivedAt.getTime() - DEDUPE_WINDOW_SECONDS * 1000
  );
  const priorEvent = await repository.findRecentNormalizedEventByDedupeKey(
    normalized.dedupeKey,
    receivedAtFloor,
    normalized.receivedAt
  );
  const duplicate = Boolean(priorEvent);
  const inserted = await repository.insertNormalizedEvent({
    rawEventId: rawEvent.id,
    tenantId: rawEvent.tenantId,
    branchId: rawEvent.branchId,
    receivedAt: rawEvent.receivedAt,
    rawEventType: normalized.rawEventType,
    normalizedEventClass: normalized.normalizedEventClass,
    entityType: normalized.entityType,
    entityId: normalized.entityId,
    statusCodeRaw: normalized.statusCodeRaw,
    dedupeKey: normalized.dedupeKey,
    duplicate,
    normalizationVersion: NORMALIZATION_VERSION
  });

  return {
    rawEventId: rawEvent.id,
    normalizedEventId: inserted.record.id,
    tenantId: rawEvent.tenantId,
    branchId: rawEvent.branchId,
    entityType: normalized.entityType,
    entityId: normalized.entityId,
    inserted: inserted.inserted,
    duplicate: inserted.record.duplicate,
    dedupeKey: inserted.record.dedupeKey,
    normalizedEventClass: inserted.record
      .normalizedEventClass as NormalizedEventClass,
    rawEventType: inserted.record.rawEventType
  };
}
