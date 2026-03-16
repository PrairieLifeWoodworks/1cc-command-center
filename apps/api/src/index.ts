import { createHash, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import { loadApiConfig, resolveSecretRef } from "@1cc/config";
import {
  SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME,
  type SmartMovingRawWebhookNormalizeJobPayload,
  type TenantBranchRouteParams
} from "@1cc/contracts";
import {
  createNormalizationJobQueue,
  createDbClient,
  findBranchByTenantAndSlug,
  findSmartMovingConnectionByBranchId,
  findTenantBySlug,
  insertRawWebhookEvent,
  type BranchRecord,
  type SmartMovingConnectionRecord,
  type TenantRecord
} from "@1cc/db";

export interface RawIngressInsert {
  tenantId: string;
  branchId: string;
  source: string;
  receivedAt?: Date;
  headersJson: Record<string, string | string[]>;
  payloadJson: unknown;
  payloadHash: string;
  authResult: string;
}

export interface SmartMovingIngressRepository {
  findTenantBySlug(slug: string): Promise<TenantRecord | null>;
  findBranchByTenantAndSlug(
    tenantId: string,
    slug: string
  ): Promise<BranchRecord | null>;
  findSmartMovingConnectionByBranchId(
    branchId: string
  ): Promise<SmartMovingConnectionRecord | null>;
  insertRawWebhookEvent(
    input: RawIngressInsert
  ): Promise<{ id: string; authResult: string; receivedAt: Date }>;
  close?(): Promise<void>;
}

export interface SmartMovingNormalizationJobPublisher {
  publish(
    payload: SmartMovingRawWebhookNormalizeJobPayload
  ): Promise<string>;
  close?(): Promise<void>;
}

export interface SmartMovingIngressRequest {
  tenantSlug: string;
  branchSlug: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

export interface SmartMovingIngressResult {
  statusCode: number;
  body: Record<string, unknown>;
}

export interface BuildApiServerOptions {
  ingressRepository?: SmartMovingIngressRepository;
  normalizationJobPublisher?: SmartMovingNormalizationJobPublisher;
  secretResolver?: (
    ref: string,
    env?: NodeJS.ProcessEnv
  ) => string | undefined;
  env?: NodeJS.ProcessEnv;
}

function readAuthHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function headersToJson(
  headers: Record<string, string | string[] | undefined>
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== undefined)
  ) as Record<string, string | string[]>;
}

function payloadToJson(payload: unknown): unknown {
  if (payload === undefined || payload === null) {
    return {};
  }

  return payload;
}

function computePayloadHash(payload: unknown): string {
  const serializedPayload = JSON.stringify(payload) ?? "null";

  return createHash("sha256").update(serializedPayload).digest("hex");
}

function hasJobId(jobId: string | null | undefined): jobId is string {
  return typeof jobId === "string" && jobId.trim().length > 0;
}

function secretsMatch(
  expectedSecret: string,
  providedSecret: string | undefined
): boolean {
  if (!providedSecret) {
    return false;
  }

  const expectedBuffer = Buffer.from(expectedSecret);
  const providedBuffer = Buffer.from(providedSecret);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function createDefaultIngressRepository(
  env: NodeJS.ProcessEnv = process.env
): SmartMovingIngressRepository {
  const dbClient = createDbClient({}, env);

  return {
    findTenantBySlug: (slug) => findTenantBySlug(dbClient.db, slug),
    findBranchByTenantAndSlug: (tenantId, slug) =>
      findBranchByTenantAndSlug(dbClient.db, tenantId, slug),
    findSmartMovingConnectionByBranchId: (branchId) =>
      findSmartMovingConnectionByBranchId(dbClient.db, branchId),
    insertRawWebhookEvent: (input) => insertRawWebhookEvent(dbClient.db, input),
    close: () => dbClient.pool.end()
  };
}

function createDefaultNormalizationJobPublisher(
  env: NodeJS.ProcessEnv = process.env
): SmartMovingNormalizationJobPublisher {
  return createNormalizationJobQueue({}, env);
}

export async function handleSmartMovingWebhookIngress(
  input: SmartMovingIngressRequest,
  dependencies: {
    ingressRepository: SmartMovingIngressRepository;
    normalizationJobPublisher: SmartMovingNormalizationJobPublisher;
    secretResolver: (
      ref: string,
      env?: NodeJS.ProcessEnv
    ) => string | undefined;
    env?: NodeJS.ProcessEnv;
  }
): Promise<SmartMovingIngressResult> {
  const env = dependencies.env ?? process.env;
  const tenantRecord = await dependencies.ingressRepository.findTenantBySlug(
    input.tenantSlug
  );

  if (!tenantRecord) {
    return {
      statusCode: 404,
      body: {
        ok: false,
        status: "not_found",
        message: `Tenant '${input.tenantSlug}' was not found.`
      }
    };
  }

  const branchRecord = await dependencies.ingressRepository.findBranchByTenantAndSlug(
    tenantRecord.id,
    input.branchSlug
  );

  if (!branchRecord) {
    return {
      statusCode: 404,
      body: {
        ok: false,
        status: "not_found",
        message: `Branch '${input.branchSlug}' was not found for tenant '${input.tenantSlug}'.`
      }
    };
  }

  const connectionRecord =
    await dependencies.ingressRepository.findSmartMovingConnectionByBranchId(
      branchRecord.id
    );

  if (!connectionRecord) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        status: "integration_not_configured",
        message: "SmartMoving integration is not configured for this branch."
      }
    };
  }

  const expectedSecret = dependencies.secretResolver(
    connectionRecord.webhookSecretRef,
    env
  );

  if (!expectedSecret) {
    return {
      statusCode: 503,
      body: {
        ok: false,
        status: "integration_not_configured",
        message:
          "The SmartMoving webhook secret reference is configured, but the runtime secret is missing."
      }
    };
  }

  const payloadJson = payloadToJson(input.body);
  const payloadHash = computePayloadHash(payloadJson);
  const headersJson = headersToJson(input.headers);
  const authHeader = readAuthHeader(input.headers["x-smartmoving-auth"]);

  if (!secretsMatch(expectedSecret, authHeader)) {
    await dependencies.ingressRepository.insertRawWebhookEvent({
      tenantId: tenantRecord.id,
      branchId: branchRecord.id,
      source: "smartmoving",
      headersJson,
      payloadJson,
      payloadHash,
      authResult: "rejected_invalid_auth"
    });

    return {
      statusCode: 401,
      body: {
        ok: false,
        status: "unauthorized",
        message:
          "The SmartMoving webhook auth header did not match the configured secret."
      }
    };
  }

  const rawWebhookEventRecord =
    await dependencies.ingressRepository.insertRawWebhookEvent({
      tenantId: tenantRecord.id,
      branchId: branchRecord.id,
      source: "smartmoving",
      headersJson,
      payloadJson,
      payloadHash,
      authResult: "accepted"
    });

  try {
    const normalizationJobId = await dependencies.normalizationJobPublisher.publish({
      rawEventId: rawWebhookEventRecord.id,
      tenantId: tenantRecord.id,
      branchId: branchRecord.id
    });

    if (!hasJobId(normalizationJobId)) {
      throw new Error(
        `Normalization enqueue returned no job id for raw event '${rawWebhookEventRecord.id}'.`
      );
    }
  } catch {
    return {
      statusCode: 503,
      body: {
        ok: false,
        status: "queue_unavailable",
        message:
          "Raw SmartMoving webhook ingress was persisted, but normalization enqueue failed.",
        rawEventId: rawWebhookEventRecord.id
      }
    };
  }

  return {
    statusCode: 202,
    body: {
      ok: true,
      status: "accepted",
      message: "Raw SmartMoving webhook ingress accepted.",
      rawEventId: rawWebhookEventRecord.id,
      enqueuedJob: SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME
    }
  };
}

export function buildApiServer(
  options: BuildApiServerOptions = {}
): FastifyInstance {
  const env = options.env ?? process.env;
  const config = loadApiConfig(env);
  const ingressRepository =
    options.ingressRepository ?? createDefaultIngressRepository(env);
  const normalizationJobPublisher =
    options.normalizationJobPublisher ??
    createDefaultNormalizationJobPublisher(env);
  const secretResolver = options.secretResolver ?? resolveSecretRef;

  const app = Fastify({
    logger: {
      level: config.logLevel
    }
  });

  if (ingressRepository.close) {
    app.addHook("onClose", async () => {
      await ingressRepository.close?.();
    });
  }

  if (normalizationJobPublisher.close) {
    app.addHook("onClose", async () => {
      await normalizationJobPublisher.close?.();
    });
  }

  app.get("/health", async () => {
    return {
      ok: true,
      status: "healthy"
    };
  });

  app.post<{ Params: TenantBranchRouteParams }>(
    "/webhook/smartmoving/:tenantSlug/:branchSlug",
    async (request, reply) => {
      const result = await handleSmartMovingWebhookIngress(
        {
          tenantSlug: request.params.tenantSlug,
          branchSlug: request.params.branchSlug,
          headers: request.headers,
          body: request.body
        },
        {
          ingressRepository,
          normalizationJobPublisher,
          secretResolver,
          env
        }
      );

      reply.code(result.statusCode);

      return result.body;
    }
  );

  return app;
}

async function start(): Promise<void> {
  const config = loadApiConfig();
  let app: FastifyInstance | undefined;

  try {
    app = buildApiServer();

    await app.listen({
      host: "0.0.0.0",
      port: config.port
    });
  } catch (error) {
    if (app) {
      app.log.error(error);
    } else {
      console.error(error);
    }

    process.exitCode = 1;
  }
}

if (require.main === module) {
  void start();
}
