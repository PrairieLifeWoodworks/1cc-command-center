import { resolveSecretRef } from "@1cc/config";
import type { SmartMovingConnectionRecord } from "@1cc/db";

export class SmartMovingApiError extends Error {
  readonly statusCode: number;
  readonly responseBody: string;

  constructor(message: string, statusCode: number, responseBody: string) {
    super(message);
    this.name = "SmartMovingApiError";
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export interface SmartMovingConnectionRepository {
  findSmartMovingConnectionByBranchId(
    branchId: string
  ): Promise<SmartMovingConnectionRecord | null>;
}

export interface SmartMovingApiClient {
  getOpportunityDetails(opportunityId: string): Promise<unknown>;
  getOpportunityAuditActivity(opportunityId: string): Promise<unknown>;
  getOpportunityFollowups(opportunityId: string): Promise<unknown>;
}

export interface SmartMovingApiClientFactory {
  forBranch(branchId: string): Promise<SmartMovingApiClient>;
}

export interface CreateSmartMovingApiClientFactoryOptions {
  repository: SmartMovingConnectionRepository;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  secretResolver?: (
    ref: string,
    env?: NodeJS.ProcessEnv
  ) => string | undefined;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function buildRequestUrl(apiBaseUrl: string, path: string): string {
  return `${trimTrailingSlash(apiBaseUrl)}${path}`;
}

function createSmartMovingApiClient(
  connection: SmartMovingConnectionRecord,
  apiKey: string,
  fetchFn: typeof fetch
): SmartMovingApiClient {
  async function requestJson(path: string): Promise<unknown> {
    const response = await fetchFn(buildRequestUrl(connection.apiBaseUrl, path), {
      headers: {
        "x-api-key": apiKey
      }
    });

    if (!response.ok) {
      throw new SmartMovingApiError(
        `SmartMoving request failed for '${path}'.`,
        response.status,
        await response.text()
      );
    }

    return response.json();
  }

  return {
    getOpportunityDetails(opportunityId) {
      return requestJson(`/api/opportunities/${encodeURIComponent(opportunityId)}`);
    },
    getOpportunityAuditActivity(opportunityId) {
      return requestJson(
        `/api/opportunities/${encodeURIComponent(opportunityId)}/audit-activity`
      );
    },
    getOpportunityFollowups(opportunityId) {
      return requestJson(
        `/api/premium/opportunities/${encodeURIComponent(opportunityId)}/followups`
      );
    }
  };
}

export function createSmartMovingApiClientFactory(
  options: CreateSmartMovingApiClientFactoryOptions
): SmartMovingApiClientFactory {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchFn ?? fetch;
  const secretResolver = options.secretResolver ?? resolveSecretRef;

  return {
    async forBranch(branchId: string): Promise<SmartMovingApiClient> {
      const connection = await options.repository.findSmartMovingConnectionByBranchId(
        branchId
      );

      if (!connection) {
        throw new Error(
          `SmartMoving connection is not configured for branch '${branchId}'.`
        );
      }

      const apiKey = secretResolver(connection.apiKeySecretRef, env);

      if (!apiKey) {
        throw new Error(
          `SmartMoving API key secret '${connection.apiKeySecretRef}' is missing from runtime env.`
        );
      }

      return createSmartMovingApiClient(connection, apiKey, fetchFn);
    }
  };
}
