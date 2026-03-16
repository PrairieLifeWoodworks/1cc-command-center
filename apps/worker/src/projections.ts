import { resolveSmartMovingOpportunityStatusLabel } from "@1cc/config";
import type {
  FollowUpProjectionCandidate,
  LeadFlowProjectionCandidate
} from "@1cc/contracts";

type SnapshotInput = {
  tenantId: string;
  branchId: string;
  opportunityId: string;
  fetchedAt: Date;
  opportunityJson: unknown;
  followupsJson: unknown | null;
};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

function readObjectString(record: JsonRecord | null, key: string): string | null {
  if (!record) {
    return null;
  }

  return readString(record[key]);
}

export function deriveLeadFlowProjectionCandidate(
  snapshot: SnapshotInput
): LeadFlowProjectionCandidate {
  const opportunity = asRecord(snapshot.opportunityJson);
  const customer = asRecord(opportunity?.customer);
  const salesAssignee = asRecord(opportunity?.salesAssignee);
  const statusCodeRaw = readObjectString(opportunity, "status");

  return {
    tenantId: snapshot.tenantId,
    branchId: snapshot.branchId,
    opportunityId: snapshot.opportunityId,
    quoteNumber: readObjectString(opportunity, "quoteNumber"),
    customerName: readObjectString(customer, "name"),
    salespersonName: readObjectString(salesAssignee, "name"),
    statusCodeRaw,
    statusLabelCandidate: resolveSmartMovingOpportunityStatusLabel(statusCodeRaw),
    leadStatusCandidate: readObjectString(opportunity, "leadStatus"),
    serviceDate: readObjectString(opportunity, "serviceDate"),
    snapshotFetchedAt: snapshot.fetchedAt.toISOString()
  };
}

export function deriveFollowUpProjectionCandidates(
  snapshot: SnapshotInput
): FollowUpProjectionCandidate[] {
  if (!Array.isArray(snapshot.followupsJson)) {
    return [];
  }

  const opportunity = asRecord(snapshot.opportunityJson);
  const salesAssignee = asRecord(opportunity?.salesAssignee);
  const quoteNumber = readObjectString(opportunity, "quoteNumber");
  const fallbackAssigneeName = readObjectString(salesAssignee, "name");

  return snapshot.followupsJson.map((followup) => {
    const followupRecord = asRecord(followup);

    return {
      tenantId: snapshot.tenantId,
      branchId: snapshot.branchId,
      opportunityId: snapshot.opportunityId,
      quoteNumber,
      assigneeName:
        readObjectString(followupRecord, "assigneeName") ?? fallbackAssigneeName,
      dueAt: readObjectString(followupRecord, "dueAt"),
      titleCandidate: readObjectString(followupRecord, "title"),
      descriptionCandidate: readObjectString(followupRecord, "description"),
      completedCandidate:
        readBoolean(followupRecord?.completed) ??
        readBoolean(followupRecord?.isCompleted)
    };
  });
}
