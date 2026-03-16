import { loadWorkerConfig } from "@1cc/config";
import {
  SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME,
  SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME,
  type SmartMovingNormalizedEventHydrateJobPayload,
  type SmartMovingRawWebhookNormalizeJobPayload
} from "@1cc/contracts";
import {
  createDbClient,
  createPgBossClient,
  findHydratedOpportunitySnapshotByNormalizedEventId,
  findNormalizedEventById,
  findRawWebhookEventById,
  findRecentNormalizedEventByDedupeKey,
  findSmartMovingConnectionByBranchId,
  insertHydratedOpportunitySnapshot,
  insertNormalizedEvent,
  type DbClient
} from "@1cc/db";

import {
  buildHydrationJobPayloadFromNormalization,
  normalizeAcceptedRawWebhookEvent,
  type NormalizationRepository
} from "./normalization";
import {
  hydrateNormalizedOpportunityEvent,
  type HydrationRepository
} from "./hydration";
import {
  createSmartMovingApiClientFactory,
  type SmartMovingApiClientFactory,
  type SmartMovingConnectionRepository
} from "./smartmoving";

export interface WorkerBoss {
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
  send(name: string, data: object): Promise<string | null>;
  work(
    name: string,
    handler: (job: { data: unknown }) => Promise<void>
  ): Promise<unknown>;
}

export interface WorkerRepository
  extends NormalizationRepository,
    HydrationRepository,
    SmartMovingConnectionRepository {}

export interface WorkerDependencies {
  repository?: WorkerRepository;
  boss?: WorkerBoss;
  smartMovingClientFactory?: SmartMovingApiClientFactory;
  close?(): Promise<void>;
  env?: NodeJS.ProcessEnv;
}

export interface WorkerService {
  start(): Promise<void>;
  stop(): Promise<void>;
}

function createWorkerRepository(db: DbClient): WorkerRepository {
  return {
    findRawWebhookEventById: (rawEventId) => findRawWebhookEventById(db, rawEventId),
    findRecentNormalizedEventByDedupeKey: (
      dedupeKey,
      receivedAtFloor,
      receivedAtCeiling
    ) =>
      findRecentNormalizedEventByDedupeKey(
        db,
        dedupeKey,
        receivedAtFloor,
        receivedAtCeiling
      ),
    insertNormalizedEvent: (input) => insertNormalizedEvent(db, input),
    findNormalizedEventById: (normalizedEventId) =>
      findNormalizedEventById(db, normalizedEventId),
    insertHydratedOpportunitySnapshot: (input) =>
      insertHydratedOpportunitySnapshot(db, input),
    findHydratedOpportunitySnapshotByNormalizedEventId: (normalizedEventId) =>
      findHydratedOpportunitySnapshotByNormalizedEventId(db, normalizedEventId),
    findSmartMovingConnectionByBranchId: (branchId) =>
      findSmartMovingConnectionByBranchId(db, branchId)
  };
}

function readJobData<TPayload>(job: { data: unknown } | Array<{ data: unknown }>): TPayload | null {
  const jobData = Array.isArray(job) ? job[0]?.data : job.data;

  return jobData ? (jobData as TPayload) : null;
}

export function buildWorkerService(
  dependencies: WorkerDependencies = {}
): WorkerService {
  const env = dependencies.env ?? process.env;
  const config = loadWorkerConfig(env);
  const dbClient = dependencies.repository ? undefined : createDbClient({}, env);
  const repository =
    dependencies.repository ?? createWorkerRepository(dbClient!.db);
  const boss = dependencies.boss ?? createPgBossClient({}, env);
  const smartMovingClientFactory =
    dependencies.smartMovingClientFactory ??
    createSmartMovingApiClientFactory({
      repository,
      env
    });
  let started = false;

  return {
    async start(): Promise<void> {
      await boss.start();
      started = true;
      await boss.work(
        SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME,
        async (job) => {
          const jobData = readJobData<SmartMovingRawWebhookNormalizeJobPayload>(job);

          if (!jobData) {
            return;
          }

          const normalizationResult = await normalizeAcceptedRawWebhookEvent(
            repository,
            jobData
          );
          const hydrationJob =
            buildHydrationJobPayloadFromNormalization(normalizationResult);

          if (hydrationJob) {
            const existingSnapshot =
              await repository.findHydratedOpportunitySnapshotByNormalizedEventId(
                hydrationJob.normalizedEventId
              );

            if (!existingSnapshot) {
              await boss.send(
                SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME,
                hydrationJob
              );
            }
          }
        }
      );
      await boss.work(
        SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME,
        async (job) => {
          const jobData = readJobData<SmartMovingNormalizedEventHydrateJobPayload>(
            job
          );

          if (!jobData) {
            return;
          }

          await hydrateNormalizedOpportunityEvent(
            repository,
            smartMovingClientFactory,
            jobData
          );
        }
      );

      console.log(
        `[worker] started nodeEnv=${config.nodeEnv} logLevel=${config.logLevel} queues=${SMARTMOVING_RAW_WEBHOOK_NORMALIZE_JOB_NAME},${SMARTMOVING_NORMALIZED_EVENT_HYDRATE_JOB_NAME}`
      );
    },
    async stop(): Promise<void> {
      if (started) {
        await boss.stop();
        started = false;
      }

      if (dependencies.close) {
        await dependencies.close();
      } else if (dbClient) {
        await dbClient.pool.end();
      }
    }
  };
}

async function start(): Promise<void> {
  const worker = buildWorkerService();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    console.log(`[worker] received ${signal}, shutting down`);
    await worker.stop();
    process.exit(0);
  };

  process.on("SIGINT", (signal) => {
    void shutdown(signal);
  });
  process.on("SIGTERM", (signal) => {
    void shutdown(signal);
  });

  try {
    await worker.start();
  } catch (error) {
    console.error("[worker] failed to start", error);
    await worker.stop().catch(() => undefined);
    process.exit(1);
  }
}

if (require.main === module) {
  void start();
}
