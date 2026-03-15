import {
  loadDatabaseConfig,
  loadSmartMovingBranchBootstrapConfig
} from "@1cc/config";
import {
  createDbClient,
  upsertBranch,
  upsertSmartMovingConnection,
  upsertTenant
} from "@1cc/db";

async function main(): Promise<void> {
  const env = process.env;

  loadDatabaseConfig(env);
  const bootstrapConfig = loadSmartMovingBranchBootstrapConfig(env);
  const dbClient = createDbClient({}, env);

  try {
    const tenantRecord = await upsertTenant(dbClient.db, {
      slug: bootstrapConfig.tenantSlug,
      name: bootstrapConfig.tenantName,
      timezoneDefault: bootstrapConfig.tenantTimezoneDefault,
      status: bootstrapConfig.tenantStatus
    });

    const branchRecord = await upsertBranch(dbClient.db, {
      tenantId: tenantRecord.id,
      slug: bootstrapConfig.branchSlug,
      name: bootstrapConfig.branchName,
      timezone: bootstrapConfig.branchTimezone,
      status: bootstrapConfig.branchStatus
    });

    const connectionRecord = await upsertSmartMovingConnection(dbClient.db, {
      branchId: branchRecord.id,
      apiBaseUrl: bootstrapConfig.smartmovingApiBaseUrl,
      apiKeySecretRef: bootstrapConfig.smartmovingApiKeySecretRef,
      webhookSecretRef: bootstrapConfig.smartmovingWebhookSecretRef,
      onboardingStatus: bootstrapConfig.smartmovingOnboardingStatus
    });

    console.log(
      `[bootstrap-smartmoving-branch] upserted tenant=${tenantRecord.slug} branch=${branchRecord.slug} onboardingStatus=${connectionRecord.onboardingStatus}`
    );
  } finally {
    await dbClient.pool.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[bootstrap-smartmoving-branch] ${message}`);
  process.exit(1);
});
