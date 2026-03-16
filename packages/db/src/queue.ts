import PgBoss = require("pg-boss");

import { loadDatabaseConfig, loadOptionalDatabaseConfig } from "@1cc/config";
import {
  SMARTMOVING_JOB_QUEUE_NAMES,
  SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME,
  SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME,
  type SmartMovingJobQueueName,
  type SmartMovingNormalizedEventHydrateJobPayload,
  type SmartMovingRawWebhookNormalizeJobPayload
} from "@1cc/contracts";

export interface CreateJobQueueOptions {
  databaseUrl?: string;
  databaseSsl?: boolean;
}

export interface NormalizationJobQueue {
  publish(payload: SmartMovingRawWebhookNormalizeJobPayload): Promise<string>;
  close(): Promise<void>;
}

export interface HydrationJobQueue {
  publish(payload: SmartMovingNormalizedEventHydrateJobPayload): Promise<string>;
  close(): Promise<void>;
}

export interface PgBossQueueClient {
  createQueue(name: string): Promise<void>;
  send(name: string, data: object): Promise<string | null>;
}

export interface QueueRegistrationState {
  ensuredQueues: Map<string, Promise<void>>;
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

export function createQueueRegistrationState(): QueueRegistrationState {
  return {
    ensuredQueues: new Map()
  };
}

export async function ensureSmartMovingJobQueues(
  boss: PgBossQueueClient,
  state: QueueRegistrationState = createQueueRegistrationState()
): Promise<void> {
  await Promise.all(
    SMARTMOVING_JOB_QUEUE_NAMES.map((queueName) =>
      ensureQueueExists(boss, queueName, state)
    )
  );
}

export async function publishJobToQueue<TPayload>(
  boss: PgBossQueueClient,
  queueName: SmartMovingJobQueueName,
  payload: TPayload,
  state: QueueRegistrationState = createQueueRegistrationState()
): Promise<string> {
  await ensureQueueExists(boss, queueName, state);

  const jobId = await boss.send(queueName, payload as object);

  if (!jobId?.trim()) {
    throw new Error(`pg-boss did not return a job id for queue '${queueName}'.`);
  }

  return jobId;
}

function createQueuePublisher<TPayload>(
  queueName: string,
  options: CreateJobQueueOptions = {},
  env: NodeJS.ProcessEnv = process.env
): {
  publish(payload: TPayload): Promise<string>;
  close(): Promise<void>;
} {
  const boss = createPgBossClient(options, env);
  const queueState = createQueueRegistrationState();
  let startPromise: Promise<unknown> | undefined;

  async function ensureStarted(): Promise<void> {
    if (!startPromise) {
      startPromise = boss.start();
    }

    await startPromise;
  }

  return {
    async publish(payload): Promise<string> {
      await ensureStarted();
      return publishJobToQueue(
        boss,
        queueName as SmartMovingJobQueueName,
        payload,
        queueState
      );
    },
    async close(): Promise<void> {
      if (startPromise) {
        await boss.stop();
      }
    }
  };
}

async function ensureQueueExists(
  boss: PgBossQueueClient,
  queueName: string,
  state: QueueRegistrationState
): Promise<void> {
  let ensuredQueue = state.ensuredQueues.get(queueName);

  if (!ensuredQueue) {
    ensuredQueue = boss.createQueue(queueName);
    state.ensuredQueues.set(queueName, ensuredQueue);
  }

  try {
    await ensuredQueue;
  } catch (error) {
    state.ensuredQueues.delete(queueName);
    throw error;
  }
}
