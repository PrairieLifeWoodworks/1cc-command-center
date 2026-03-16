# 1CC Command Center

Initial Phase 1 backbone scaffold for the hosted backend workspace.

Scaffolded in this repo:
- `apps/api`: Fastify-based API app with a real `/health` route and SmartMoving raw-ingress
- `apps/worker`: PostgreSQL-backed worker scaffold for normalization and hydration jobs
- `packages/config`: shared environment parsing, secret-ref resolution, and SmartMoving status-label helpers
- `packages/contracts`: shared contracts for tenant/branch routing, queue payloads, normalized events, and projection candidates
- `packages/db`: Drizzle + Postgres schema, lazy DB/queue clients, and repositories for the hosted backbone tables

Intentionally deferred in this scaffold:
- SSE transport
- polling, report ingestion, or browser automation
- Speed-to-Lead computation
- Electron desktop app and admin web app

## Commands

```bash
npm install
npm run build
npm run db:generate
npm run db:migrate
npm run bootstrap:smartmoving-branch
npm run start:worker
```

To run the compiled processes after a successful build:

```bash
node apps/api/dist/index.js
node apps/worker/dist/index.js
```

The DB scaffold does not connect on import and does not run migrations against a live database in this repo task.

`db:migrate` applies the existing SQL migrations in `drizzle/` to the target Postgres database using the configured `DATABASE_URL`.
`bootstrap:smartmoving-branch` is a pilot-only setup command that upserts one tenant, one branch, and one `smartmoving_connection` from environment variables.
Accepted SmartMoving raw webhooks are persisted by the API, enqueued to PostgreSQL-backed jobs, normalized by the worker, and hydrated into durable opportunity snapshots.
The queue layer explicitly creates the normalization and hydration queues and only treats enqueue as successful when `pg-boss` returns a real job id.
Projection-candidate mappers for Lead Flow and Follow-Up Board exist in the worker layer, but final persisted product projection tables are still deferred.

Hosted Railway smoke-test steps live in [docs/operations/HOSTED_SMOKE_TEST_RUNBOOK.md](/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/operations/HOSTED_SMOKE_TEST_RUNBOOK.md).
Separate Railway worker service setup steps live in [docs/operations/RAILWAY_WORKER_SERVICE_RUNBOOK.md](/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/operations/RAILWAY_WORKER_SERVICE_RUNBOOK.md).
