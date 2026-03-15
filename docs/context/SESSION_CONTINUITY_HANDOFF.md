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

## Source Hierarchy For STL Truth
1. Direct timestamped API/event evidence if proven
2. Active-set polling for unresolved assigned leads if timestamped attempt data is readable
3. Report ingestion for authoritative fallback/backfill
4. Browser-agent report retrieval only if direct product surfaces are insufficient

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
  - backend app service has not been created yet
  - public app URL does not exist yet

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
Next operator step is a real hosted smoke test:
- add the backend service for this repo in Railway
- set Railway/runtime env for this repo
- run `npm run db:migrate` against Railway Postgres
- run `npm run bootstrap:smartmoving-branch`
- verify hosted ingress with manual `404`, `401`, and `202` checks from the runbook

Only after that should the next worker slice add normalization or queueing.

## Known Open Questions
- Can SmartMoving expose timestamped outbound call/text/email attempts through any reliable read surface?
- If not, should STL exactness rely on report ingestion for authoritative backfill?
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
