import type { SmartMovingNormalizedEventHydrateJobPayload } from "@1cc/contracts";
import type {
  HydratedOpportunitySnapshotRecord,
  NormalizedEventRecord
} from "@1cc/db";

import type { SmartMovingApiClientFactory } from "./smartmoving";

export const HYDRATED_OPPORTUNITY_SNAPSHOT_VERSION = "smartmoving_hydration_v1";

export interface HydrationRepository {
  findNormalizedEventById(
    normalizedEventId: string
  ): Promise<NormalizedEventRecord | null>;
  findHydratedOpportunitySnapshotByNormalizedEventId(
    normalizedEventId: string
  ): Promise<HydratedOpportunitySnapshotRecord | null>;
  insertHydratedOpportunitySnapshot(input: {
    normalizedEventId: string;
    rawEventId: string;
    tenantId: string;
    branchId: string;
    opportunityId: string;
    fetchedAt: Date;
    opportunityJson: unknown;
    auditActivityJson: unknown | null;
    followupsJson: unknown | null;
    snapshotVersion: string;
  }): Promise<{ record: HydratedOpportunitySnapshotRecord; inserted: boolean }>;
}

export interface HydrationResult {
  normalizedEventId: string;
  snapshotId: string;
  inserted: boolean;
  opportunityId: string;
}

async function bestEffortRead(
  operation: () => Promise<unknown>
): Promise<unknown | null> {
  try {
    return await operation();
  } catch {
    return null;
  }
}

export async function hydrateNormalizedOpportunityEvent(
  repository: HydrationRepository,
  smartMovingClientFactory: SmartMovingApiClientFactory,
  job: SmartMovingNormalizedEventHydrateJobPayload
): Promise<HydrationResult> {
  const normalizedEvent = await repository.findNormalizedEventById(
    job.normalizedEventId
  );

  if (!normalizedEvent) {
    throw new Error(`Normalized event '${job.normalizedEventId}' was not found.`);
  }

  if (normalizedEvent.entityType !== "opportunity" || !normalizedEvent.entityId) {
    throw new Error(
      `Normalized event '${job.normalizedEventId}' is not a hydratable opportunity event.`
    );
  }

  if (normalizedEvent.entityId !== job.opportunityId) {
    throw new Error(
      `Hydration job opportunity '${job.opportunityId}' did not match normalized event entity '${normalizedEvent.entityId}'.`
    );
  }

  const client = await smartMovingClientFactory.forBranch(normalizedEvent.branchId);
  const fetchedAt = new Date();
  const opportunityJson = await client.getOpportunityDetails(job.opportunityId);
  const auditActivityJson = await bestEffortRead(() =>
    client.getOpportunityAuditActivity(job.opportunityId)
  );
  const followupsJson = await bestEffortRead(() =>
    client.getOpportunityFollowups(job.opportunityId)
  );
  const inserted = await repository.insertHydratedOpportunitySnapshot({
    normalizedEventId: normalizedEvent.id,
    rawEventId: normalizedEvent.rawEventId,
    tenantId: normalizedEvent.tenantId,
    branchId: normalizedEvent.branchId,
    opportunityId: job.opportunityId,
    fetchedAt,
    opportunityJson,
    auditActivityJson,
    followupsJson,
    snapshotVersion: HYDRATED_OPPORTUNITY_SNAPSHOT_VERSION
  });

  return {
    normalizedEventId: normalizedEvent.id,
    snapshotId: inserted.record.id,
    inserted: inserted.inserted,
    opportunityId: job.opportunityId
  };
}
