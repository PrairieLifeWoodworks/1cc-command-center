# 1CC Command Center

Initial Phase 1 backbone scaffold for the hosted backend workspace.

Scaffolded in this repo:
- `apps/api`: Fastify-based API app with a real `/health` route and a SmartMoving raw-ingress skeleton
- `apps/worker`: minimal worker process scaffold
- `packages/config`: shared environment parsing for API and worker processes
- `packages/contracts`: shared architecture-stable contracts for tenant/branch routing and normalized SmartMoving event envelopes
- `packages/db`: Drizzle + Postgres schema and lazy client scaffold for the first hosted backbone tables

Intentionally deferred in this scaffold:
- SmartMoving webhook processing and hydration logic
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
```

To run the API after a successful build:

```bash
node apps/api/dist/index.js
```

The DB scaffold does not connect on import and does not run migrations against a live database in this repo task.

`db:migrate` applies the existing SQL migrations in `drizzle/` to the target Postgres database using the configured `DATABASE_URL`.
`bootstrap:smartmoving-branch` is a pilot-only setup command that upserts one tenant, one branch, and one `smartmoving_connection` from environment variables.

Hosted Railway smoke-test steps live in [docs/operations/HOSTED_SMOKE_TEST_RUNBOOK.md](/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/operations/HOSTED_SMOKE_TEST_RUNBOOK.md).
