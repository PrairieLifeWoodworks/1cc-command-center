import PgBoss = require("pg-boss");

import { loadDatabaseConfig, loadOptionalDatabaseConfig } from "@1cc/config";
import {
  SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME,
  SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME,
  type SmartMovingNormalizedEventHydrateJobPayload,
  type SmartMovingRawWebhookNormalizeJobPayload
} from "@1cc/contracts";

export interface CreateJobQueueOptions {
  databaseUrl?: string;
  databaseSsl?: boolean;
}

export interface NormalizationJobQueue {
  publish(payload: SmartMovingRawWebhookNormalizeJobPayload): Promise<string | null>;
  close(): Promise<void>;
}

export interface HydrationJobQueue {
  publish(payload: SmartMovingNormalizedEventHydrateJobPayload): Promise<string | null>;
  close(): Promise<void>;
}

export function createPgBossClient(
  options: CreateJobQueueOptions = {},
  env: NodeJS.ProcessEnv = process.env
): PgBoss {
  const databaseConfig = options.databaseUrl
    ? loadOptionalDatabaseConfig(env)
    : loadDatabaseConfig(env);
  const databaseUrl = options.databaseUrl ?? databaseConfig.databaseUrl;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create a pg-boss client");
  }

  const databaseSsl = options.databaseSsl ?? databaseConfig.databaseSsl;

  return new PgBoss({
    connectionString: databaseUrl,
    ssl: databaseSsl ? { rejectUnauthorized: false } : undefined
  });
}

export function createNormalizationJobQueue(
  options: CreateJobQueueOptions = {},
  env: NodeJS.ProcessEnv = process.env
): NormalizationJobQueue {
  return createQueuePublisher(
    SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME,
    options,
    env
  );
}

export function createHydrationJobQueue(
  options: CreateJobQueueOptions = {},
  env: NodeJS.ProcessEnv = process.env
): HydrationJobQueue {
  return createQueuePublisher(
    SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME,
    options,
    env
  );
}

function createQueuePublisher<TPayload>(
  queueName: string,
  options: CreateJobQueueOptions = {},
  env: NodeJS.ProcessEnv = process.env
): {
  publish(payload: TPayload): Promise<string | null>;
  close(): Promise<void>;
} {
  const boss = createPgBossClient(options, env);
  let startPromise: Promise<unknown> | undefined;

  async function ensureStarted(): Promise<void> {
    if (!startPromise) {
      startPromise = boss.start();
    }

    await startPromise;
  }

  return {
    async publish(payload): Promise<string | null> {
      await ensureStarted();
      return boss.send(queueName, payload as object);
    },
    async close(): Promise<void> {
      if (startPromise) {
        await boss.stop();
      }
    }
  };
}
