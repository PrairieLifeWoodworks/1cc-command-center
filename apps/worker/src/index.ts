import { loadWorkerConfig } from "@1cc/config";

const config = loadWorkerConfig();

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[worker] received ${signal}, shutting down`);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  `[worker] started nodeEnv=${config.nodeEnv} logLevel=${config.logLevel}`
);
