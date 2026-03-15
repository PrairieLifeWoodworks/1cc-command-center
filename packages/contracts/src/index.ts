export type TenantBranchRouteParams = {
  tenantSlug: string;
  branchSlug: string;
};

export type SmartMovingEntityType = "opportunity" | "lead" | "unknown";

export type NormalizedEventClass =
  | "opportunity_created"
  | "opportunity_updated"
  | "opportunity_status_changed"
  | "lead_updated"
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
  statusCodeRaw: string | number | null;
  statusLabelCandidate: string | null;
  payloadHash: string;
  dedupeKey: string;
  duplicate: boolean;
  normalizationVersion: string;
  rawPayload: unknown;
}
