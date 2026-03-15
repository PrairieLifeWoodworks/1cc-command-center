export type NodeEnv = "development" | "test" | "production";

export type LogLevel =
  | "fatal"
  | "error"
  | "warn"
  | "info"
  | "debug"
  | "trace"
  | "silent";

export interface CommonConfig {
  nodeEnv: NodeEnv;
  logLevel: LogLevel;
  databaseUrl?: string;
  databaseSsl: boolean;
}

export interface ApiConfig extends CommonConfig {
  port: number;
}

export interface WorkerConfig extends CommonConfig {}

export interface DatabaseConfig {
  databaseUrl: string;
  databaseSsl: boolean;
}

export interface SmartMovingBranchBootstrapConfig {
  tenantSlug: string;
  tenantName: string;
  tenantTimezoneDefault: string;
  tenantStatus: string;
  branchSlug: string;
  branchName: string;
  branchTimezone: string;
  branchStatus: string;
  smartmovingApiBaseUrl: string;
  smartmovingApiKeySecretRef: string;
  smartmovingWebhookSecretRef: string;
  smartmovingOnboardingStatus: string;
}

const NODE_ENVS: readonly NodeEnv[] = ["development", "test", "production"];
const LOG_LEVELS: readonly LogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent"
];

function readNodeEnv(value: string | undefined): NodeEnv {
  if (!value) {
    return "development";
  }

  if (NODE_ENVS.includes(value as NodeEnv)) {
    return value as NodeEnv;
  }

  throw new Error(`Invalid NODE_ENV: ${value}`);
}

function readLogLevel(value: string | undefined): LogLevel {
  if (!value) {
    return "info";
  }

  if (LOG_LEVELS.includes(value as LogLevel)) {
    return value as LogLevel;
  }

  throw new Error(`Invalid LOG_LEVEL: ${value}`);
}

function readPort(value: string | undefined): number {
  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${value}`);
  }

  return port;
}

function readDatabaseUrl(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

function readRequiredEnvString(
  name: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const value = env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function readOptionalEnvString(
  name: string,
  fallbackValue: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const value = env[name];

  if (!value || value.trim().length === 0) {
    return fallbackValue;
  }

  return value.trim();
}

export function resolveSecretRef(
  ref: string,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  const value = env[ref];

  return value && value.trim().length > 0 ? value : undefined;
}

function readDatabaseSsl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalizedValue = value.toLowerCase();

  if (normalizedValue === "true" || normalizedValue === "1") {
    return true;
  }

  if (normalizedValue === "false" || normalizedValue === "0") {
    return false;
  }

  throw new Error(`Invalid DATABASE_SSL: ${value}`);
}

export function loadOptionalDatabaseConfig(
  env: NodeJS.ProcessEnv
): Pick<CommonConfig, "databaseUrl" | "databaseSsl"> {
  return {
    databaseUrl: readDatabaseUrl(env.DATABASE_URL),
    databaseSsl: readDatabaseSsl(env.DATABASE_SSL)
  };
}

export function loadDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env
): DatabaseConfig {
  const config = loadOptionalDatabaseConfig(env);

  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required to create a database client");
  }

  return {
    databaseUrl: config.databaseUrl,
    databaseSsl: config.databaseSsl
  };
}

export function loadSmartMovingBranchBootstrapConfig(
  env: NodeJS.ProcessEnv = process.env
): SmartMovingBranchBootstrapConfig {
  return {
    tenantSlug: readRequiredEnvString("TENANT_SLUG", env),
    tenantName: readRequiredEnvString("TENANT_NAME", env),
    tenantTimezoneDefault: readRequiredEnvString(
      "TENANT_TIMEZONE_DEFAULT",
      env
    ),
    tenantStatus: readOptionalEnvString("TENANT_STATUS", "active", env),
    branchSlug: readRequiredEnvString("BRANCH_SLUG", env),
    branchName: readRequiredEnvString("BRANCH_NAME", env),
    branchTimezone: readRequiredEnvString("BRANCH_TIMEZONE", env),
    branchStatus: readOptionalEnvString("BRANCH_STATUS", "active", env),
    smartmovingApiBaseUrl: readRequiredEnvString(
      "SMARTMOVING_API_BASE_URL",
      env
    ),
    smartmovingApiKeySecretRef: readRequiredEnvString(
      "SMARTMOVING_API_KEY_SECRET_REF",
      env
    ),
    smartmovingWebhookSecretRef: readRequiredEnvString(
      "SMARTMOVING_WEBHOOK_SECRET_REF",
      env
    ),
    smartmovingOnboardingStatus: readOptionalEnvString(
      "SMARTMOVING_ONBOARDING_STATUS",
      "pending",
      env
    )
  };
}

export function loadApiConfig(
  env: NodeJS.ProcessEnv = process.env
): ApiConfig {
  return {
    nodeEnv: readNodeEnv(env.NODE_ENV),
    logLevel: readLogLevel(env.LOG_LEVEL),
    port: readPort(env.PORT),
    ...loadOptionalDatabaseConfig(env)
  };
}

export function loadWorkerConfig(
  env: NodeJS.ProcessEnv = process.env
): WorkerConfig {
  return {
    nodeEnv: readNodeEnv(env.NODE_ENV),
    logLevel: readLogLevel(env.LOG_LEVEL),
    ...loadOptionalDatabaseConfig(env)
  };
}
