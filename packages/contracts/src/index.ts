export type TenantBranchRouteParams = {
  tenantSlug: string;
  branchSlug: string;
};

export const SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME =
  "smartmoving.raw-webhook.normalize";

export interface SmartMovingRawWebhookNormalizeJobPayload {
  rawEventId: string;
  tenantId: string;
  branchId: string;
}

export const SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME =
  "smartmoving.normalized-event.hydrate";

export const SMARTMOVING_JOB_QUEUE_NAMES = [
  SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME,
  SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME
] as const;

export type SmartMovingJobQueueName =
  (typeof SMARTMOVING_JOB_QUEUE_NAMES)[number];

export interface SmartMovingNormalizedEventHydrateJobPayload {
  normalizedEventId: string;
  rawEventId: string;
  tenantId: string;
  branchId: string;
  opportunityId: string;
}

export type SmartMovingEntityType = "opportunity" | "unknown";

export type NormalizedEventClass =
  | "opportunity_created"
  | "opportunity_updated"
  | "opportunity_status_changed"
  | "unknown";

export interface NormalizedSmartMovingEventEnvelope {
  eventId: string;
  source: "smartmoving";
  tenantId: string;
  branchId: string;
  receivedAt: string;
  rawEventType: string;
  normalizedEventClass: NormalizedEventClass;
  entityType: SmartMovingEntityType;
  entityId: string | null;
  statusCodeRaw: string | null;
  statusLabelCandidate: string | null;
  payloadHash: string;
  dedupeKey: string;
  duplicate: boolean;
  normalizationVersion: string;
  rawPayload: unknown;
}

export interface LeadFlowProjectionCandidate {
  tenantId: string;
  branchId: string;
  opportunityId: string;
  quoteNumber: string | null;
  customerName: string | null;
  salespersonName: string | null;
  statusCodeRaw: string | null;
  statusLabelCandidate: string | null;
  leadStatusCandidate: string | null;
  serviceDate: string | null;
  snapshotFetchedAt: string;
}

export interface FollowUpProjectionCandidate {
  tenantId: string;
  branchId: string;
  opportunityId: string;
  quoteNumber: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  titleCandidate: string | null;
  descriptionCandidate: string | null;
  completedCandidate: boolean | null;
}
