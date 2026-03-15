import { createHash, timingSafeEqual } from "node:crypto";

import Fastify, { type FastifyInstance } from "fastify";

import { loadApiConfig, resolveSecretRef } from "@1cc/config";
import type { TenantBranchRouteParams } from "@1cc/contracts";
import {
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

export interface BuildApiServerOptions {
  ingressRepository?: SmartMovingIngressRepository;
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

export function buildApiServer(
  options: BuildApiServerOptions = {}
): FastifyInstance {
  const env = options.env ?? process.env;
  const config = loadApiConfig(env);
  const ingressRepository =
    options.ingressRepository ?? createDefaultIngressRepository(env);
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

  app.get("/health", async () => {
    return {
      ok: true,
      status: "healthy"
    };
  });

  app.post<{ Params: TenantBranchRouteParams }>(
    "/webhook/smartmoving/:tenantSlug/:branchSlug",
    async (request, reply) => {
      const tenantRecord = await ingressRepository.findTenantBySlug(
        request.params.tenantSlug
      );

      if (!tenantRecord) {
        reply.code(404);

        return {
          ok: false,
          status: "not_found",
          message: `Tenant '${request.params.tenantSlug}' was not found.`
        };
      }

      const branchRecord = await ingressRepository.findBranchByTenantAndSlug(
        tenantRecord.id,
        request.params.branchSlug
      );

      if (!branchRecord) {
        reply.code(404);

        return {
          ok: false,
          status: "not_found",
          message: `Branch '${request.params.branchSlug}' was not found for tenant '${request.params.tenantSlug}'.`
        };
      }

      const connectionRecord =
        await ingressRepository.findSmartMovingConnectionByBranchId(
          branchRecord.id
        );

      if (!connectionRecord) {
        reply.code(503);

        return {
          ok: false,
          status: "integration_not_configured",
          message: "SmartMoving integration is not configured for this branch."
        };
      }

      const expectedSecret = secretResolver(connectionRecord.webhookSecretRef, env);

      if (!expectedSecret) {
        reply.code(503);

        return {
          ok: false,
          status: "integration_not_configured",
          message:
            "The SmartMoving webhook secret reference is configured, but the runtime secret is missing."
        };
      }

      const payloadJson = payloadToJson(request.body);
      const payloadHash = computePayloadHash(payloadJson);
      const headersJson = headersToJson(request.headers);
      const authHeader = readAuthHeader(request.headers["x-smartmoving-auth"]);

      if (!secretsMatch(expectedSecret, authHeader)) {
        await ingressRepository.insertRawWebhookEvent({
          tenantId: tenantRecord.id,
          branchId: branchRecord.id,
          source: "smartmoving",
          headersJson,
          payloadJson,
          payloadHash,
          authResult: "rejected_invalid_auth"
        });

        reply.code(401);

        return {
          ok: false,
          status: "unauthorized",
          message:
            "The SmartMoving webhook auth header did not match the configured secret."
        };
      }

      const rawWebhookEventRecord = await ingressRepository.insertRawWebhookEvent({
        tenantId: tenantRecord.id,
        branchId: branchRecord.id,
        source: "smartmoving",
        headersJson,
        payloadJson,
        payloadHash,
        authResult: "accepted"
      });

      reply.code(202);

      return {
        ok: true,
        status: "accepted",
        message: "Raw SmartMoving webhook ingress accepted.",
        rawEventId: rawWebhookEventRecord.id
      };
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
