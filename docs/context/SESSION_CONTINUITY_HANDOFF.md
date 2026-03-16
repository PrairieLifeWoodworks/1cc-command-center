# Session Continuity Handoff

## Purpose
Use this file to rehydrate a new agent session quickly when context runs low.

This is a living continuity file, not a historical artifact. When facts here conflict with older context docs, prefer:
1. `docs/architecture/SMARTMOVING_INTEGRATION_SOURCE_OF_TRUTH.md`
2. this file
3. older handoff/history docs

## Current Operating Model
- Primary design/review agent: this session
- Secondary worker agent: executes narrowly scoped build prompts
- Rule: architecture, SmartMoving semantics, STL truth decisions, and scope changes route through the primary agent before adoption

## Locked Product Direction
- Product: `1cc-command-center`
- V1 is desktop-first and read-only
- First module: `Speed-to-Lead`
- Strong candidate parallel or follow-on module: `Follow-Up Board`
- Shell direction: shared tree-style filters with `Focused` and `Command` presets
- Core pattern: `webhook -> persist raw -> normalize -> dedupe -> hydrate -> project -> notify`
- Backend is authoritative
- Electron local storage is cache only
- System must be multi-tenant and multi-branch from day one

## SmartMoving Truths Already Locked
- Webhooks are thin triggers, not rich business payloads
- Primary hydration endpoint: `GET /api/opportunities/{opportunityId}`
- Generic `opportunity-changed` semantics remain vendor-opaque
- Confirmed opportunity status codes:
  - `0 NewLead`
  - `1 LeadInProgress`
  - `3 Opportunity`
  - `4 Booked`
  - `10 Completed`
  - `11 Closed`
  - `20 Cancelled`
  - `30 Lost`
  - `50 BadLead`
- Exact first outbound attempt truth is still not proven from published API/webhook docs
- Report fallback is real: SmartMoving reporting includes `Time to Contact` and `Last Communication`
- Live testing proved:
  - `opportunity-created`, `opportunity-status-changed`, and `opportunity-changed` arrive in production
  - call/text/email activity still surfaced as generic `opportunity-changed`
  - audit reliably exposed creation, reassignment, reopen, and status transitions
  - tested public API reads still did not expose a clean call/text/email timestamp
  - followups endpoint returns real due-work records and is viable for a due-follow-ups board

## Source Hierarchy For STL Truth
1. Direct timestamped API/event evidence if proven
2. Report ingestion for authoritative fallback/backfill
3. Browser-agent report retrieval if report ingestion is not automatable enough
4. Active-set polling only if a real communication timestamp source is later discovered in an API surface

## Research Guardrails
- Do not make negative claims like "there is no way" until all relevant official surfaces were checked
- Label material claims internally as `Confirmed`, `Inference`, or `Unknown`
- If a scope-critical question is unanswered in primary docs, expand once into adjacent official docs before concluding
- Log unresolved issues as testable questions, not silent assumptions

## Current Codebase State
- npm workspace scaffold exists
- Apps:
  - `apps/api`
  - `apps/worker`
- Packages:
  - `packages/config`
  - `packages/contracts`
  - `packages/db`
- Stack choices already locked:
  - TypeScript
  - Fastify
  - PostgreSQL
  - `drizzle-orm`
  - `drizzle-kit`
  - `pg`

## Current Implemented Backend State
- `GET /health` returns `{ "ok": true, "status": "healthy" }`
- `POST /webhook/smartmoving/:tenantSlug/:branchSlug` is no longer a placeholder
- Current ingress behavior:
  - resolves tenant by slug
  - resolves branch by `(tenantId, branchSlug)`
  - resolves `smartmoving_connection`
  - resolves expected webhook secret from env using `webhook_secret_ref` as the env var name
  - reads `x-smartmoving-auth`
  - computes payload hash
  - persists `raw_webhook_event` for accepted and invalid-auth cases where tenant/branch resolve
- Current response behavior:
  - `404` unknown tenant/branch
  - `503` missing connection or missing runtime secret
  - `401` invalid auth
  - `202` accepted raw ingress
- Not implemented yet:
  - normalization
  - dedupe
  - hydration
  - queueing
  - projections
  - SSE
  - Electron app
  - admin app

## Current Bootstrap State
- Pilot bootstrap script exists at `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/scripts/bootstrap-smartmoving-branch.ts`
- Purpose:
  - upsert one tenant
  - upsert one branch
  - upsert one `smartmoving_connection`
- Input model:
  - env-driven only
  - stores secret refs only, never secret values
- Current root command:
  - `npm run bootstrap:smartmoving-branch`
- Verification completed so far:
  - build passes
  - missing env failure paths were verified
  - live Postgres upsert path has not yet been verified in this environment

## Current Operations State
- Migration apply script exists at `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/scripts/apply-drizzle-migrations.ts`
- Current root migration command:
  - `npm run db:migrate`
- Hosted smoke-test runbook exists at:
  - `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/operations/HOSTED_SMOKE_TEST_RUNBOOK.md`
- Verification completed so far:
  - build passes
  - migration command wiring was verified through missing-env failure behavior
  - no live Railway migration has been executed yet in this repo session
- Railway state as of March 14, 2026:
  - separate Railway project created for `1cc-command-center`
  - project URL: `https://railway.com/project/8c985869-8762-4463-8fc4-da343bc958a2`
  - Postgres service exists and is online
  - backend app service now exists and deploys successfully
  - Railway deployment issue was fixed on GitHub by adding explicit build/start config
  - service healthcheck `/health` is passing in Railway
  - public domain/web URL is live: `https://1cc-command-center-production.up.railway.app`
  - `SMARTMOVING_WEBHOOK_SECRET_PRIORITY_MAIN_OFFICE` is now set in Railway variables
  - live smoke test has been completed successfully

## Current Env / Secret Classification
- Shared runtime:
  - `NODE_ENV`, `LOG_LEVEL`, `PORT`
  - conceptually reusable, not project identity
- Database:
  - `DATABASE_URL` must be new for this project
  - `DATABASE_SSL` is environment/connection behavior and conceptually reusable
- Pilot bootstrap:
  - `TENANT_*`, `BRANCH_*`, `SMARTMOVING_ONBOARDING_STATUS` must be project-specific
  - `SMARTMOVING_API_BASE_URL` is reusable only if the same SmartMoving environment is intentionally targeted
  - `SMARTMOVING_API_KEY_SECRET_REF` is reusable only if the same SmartMoving account/credential context is intentionally shared
  - `SMARTMOVING_WEBHOOK_SECRET_REF` should be new/project-specific
- Hosted webhook auth:
  - the actual runtime env var named by `SMARTMOVING_WEBHOOK_SECRET_REF` should be new/project-specific
  - secret refs stored in DB and actual secret values in Railway/local env are distinct and must not be conflated
- OpenAI keys are not currently part of this repo's smoke-test path

## Current Database State
- Existing tables:
  - `tenant`
  - `branch`
  - `smartmoving_connection`
  - `raw_webhook_event`
  - `normalized_event`
- Important constraints:
  - `tenant.slug` is globally unique
  - `branch(tenantId, slug)` is unique
  - `smartmoving_connection.branchId` is unique
- Secrets are stored as refs only, never raw values

## Worker Coordination Rules
- One-off worker instructions should be given inline in a code block, not stored as repo files
- Permanent reusable artifacts may live in repo docs
- Worker may suggest improvements, but does not get final say on architecture or semantics

## Current Next Step
Latest completed operator step:
- ran DB migration against Railway Postgres successfully
- bootstrapped pilot tenant `priority-moving-services`
- bootstrapped pilot branch `main-office`
- created `smartmoving_connection` row with:
  - `apiBaseUrl = https://api-public.smartmoving.com/v1`
  - `apiKeySecretRef = SMARTMOVING_API_KEY_PRIORITY_MAIN_OFFICE`
  - `webhookSecretRef = SMARTMOVING_WEBHOOK_SECRET_PRIORITY_MAIN_OFFICE`
- verified live public endpoint behaviors:
  - `/health` -> `200`
  - unknown tenant/branch webhook -> `404`
  - invalid auth webhook -> `401`
  - valid auth webhook -> `202`
- confirmed `401` and `202` requests were persisted in `raw_webhook_event`
- confirmed live SmartMoving webhook delivery from the actual vendor
- confirmed fresh-lead status transitions are visible in audit history with timestamps
- confirmed call/text/email actions still arrived only as generic `opportunity-changed`
- accepted the normalization backbone slice:
  - accepted raw ingress now enqueues a PostgreSQL-backed normalization job
  - worker consumes normalization jobs and writes `normalized_event`
  - dedupe window is 120 seconds and now bounded on both sides to avoid out-of-order false duplicates
- accepted the hydration backbone slice locally:
  - non-duplicate hydratable normalized events enqueue a second PostgreSQL-backed hydration job
  - worker can fetch SmartMoving opportunity details plus best-effort audit/followups
  - `hydrated_opportunity_snapshot` persistence and pure Lead Flow / Follow-Up candidate mappers now exist
  - normalize-to-hydrate retry path was corrected so a transient enqueue failure does not strand a normalized event without hydration
  - this slice is accepted from local fake-backed verification only, not yet proven live in Railway
- accepted the worker deployment-readiness slice:
  - root `start:worker` command now exists
  - Railway worker deployment is documented in `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/operations/RAILWAY_WORKER_SERVICE_RUNBOOK.md`
  - root `railway.json` remains API-specific by design
- confirmed the separate Railway worker service exists:
  - service name: `1cc-worker`
  - deploy completed successfully from the same GitHub repo
  - required env vars are present, including `SMARTMOVING_API_KEY_PRIORITY_MAIN_OFFICE`
  - no public domain is exposed for the worker service
  - Railway UI still needs live job processing verification; quiet/`Completed` state alone is not proof of end-to-end work
- live verification on March 16, 2026 showed:
  - a real SmartMoving status change webhook for opportunity `a7a48717-1799-4f83-b41a-b40e01739ef3` reached `raw_webhook_event`
  - `normalized_event` remained empty
  - `hydrated_opportunity_snapshot` remained empty
  - no `pgboss` schema/tables existed in Railway Postgres at query time
- after push/redeploy to commit `3d75a35`, a manual live webhook test still returned `202` with `enqueuedJob = smartmoving.raw-webhook.normalize`, but:
    - `normalized_event` remained empty
    - `hydrated_opportunity_snapshot` remained empty
    - `pgboss.queue` existed only with internal queue `__pgboss__send-it`
    - `pgboss.job` remained empty
  - current inference: the live enqueue path is silently dropping work, likely because the application is not explicitly creating queues and is treating a null/empty `pg-boss` send result as success

Next build step:
- treat exact STL as report-dependent for planning
- fix the live pg-boss enqueue path so queue creation is explicit and a failed/empty send does not return `202`
- redeploy the Railway API and worker services with that correction
- then verify one real SmartMoving event creates `raw_webhook_event`, `normalized_event`, and `hydrated_opportunity_snapshot`
- then move from hydration snapshots to final projection persistence for `Lead Flow` and `Follow-Up Board`
- keep projection design aligned to `Lead Flow` and `Follow-Up Board`, not exact STL
- research report-ingestion or report-agent architecture for exact STL
- consider `Follow-Up Board` as the strongest non-STL module candidate because it fits the proven data better than exact communication timing

Current planning artifact:
- module ranking and shell split now live in:
  - `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/architecture/1CC_COMMAND_CENTER_MODULE_PRIORITY_MAP.md`

## Known Open Questions
- Can SmartMoving expose timestamped outbound call/text/email attempts through any reliable read surface beyond the public endpoints already tested?
- What is the cleanest operating model for report ingestion:
  - scheduled exports
  - browser-agent pulls
  - manual upload fallback
- When live hydration begins, should `api_key_secret_ref` use the same env-backed secret-ref pattern as `webhook_secret_ref`?

## Reasoning Guidance
- `High` is enough for routine scaffolding, review, and bounded implementation slices
- Raise to `Extra High` for:
  - webhook normalization semantics
  - first-outbound-attempt truth logic
  - polling/report/browser-agent fallback design
  - any scope change affecting STL metric integrity

## Resume Instruction For A New Agent
Read these first, in order:
1. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/architecture/SMARTMOVING_INTEGRATION_SOURCE_OF_TRUTH.md`
2. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/context/SESSION_CONTINUITY_HANDOFF.md`
3. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/architecture/1CC_COMMAND_CENTER_V1_ARCHITECTURE_PLAN.md`
4. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/process/RESEARCH_GUARDRAILS.md`
5. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/process/BUILD_WORKER_AGENT_PROMPT.md`
