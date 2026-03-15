# Hosted Smoke Test Runbook

Purpose:
- apply the existing migration to the target Railway Postgres database
- bootstrap one pilot tenant, branch, and SmartMoving connection
- verify the hosted API ingress path manually

Scope:
- raw ingress only
- no normalization, hydration, queueing, or projection verification

## 1. Required Inputs

Database access:
- `DATABASE_URL`
- `DATABASE_SSL` optional

Pilot bootstrap values:
- `TENANT_SLUG`
- `TENANT_NAME`
- `TENANT_TIMEZONE_DEFAULT`
- `TENANT_STATUS` optional
- `BRANCH_SLUG`
- `BRANCH_NAME`
- `BRANCH_TIMEZONE`
- `BRANCH_STATUS` optional
- `SMARTMOVING_API_BASE_URL`
- `SMARTMOVING_API_KEY_SECRET_REF`
- `SMARTMOVING_WEBHOOK_SECRET_REF`
- `SMARTMOVING_ONBOARDING_STATUS` optional

Hosted API runtime values:
- `DATABASE_URL`
- `DATABASE_SSL` optional
- env var named exactly as `SMARTMOVING_WEBHOOK_SECRET_REF`
  - example placeholder:
    - if `SMARTMOVING_WEBHOOK_SECRET_REF=SMARTMOVING_WEBHOOK_SECRET_PILOT_DALLAS`
    - then the deployed API must also have `SMARTMOVING_WEBHOOK_SECRET_PILOT_DALLAS=<placeholder-secret-value>`

## 2. Apply Migration

From the repo root:

```bash
export DATABASE_URL="<railway-postgres-url>"
export DATABASE_SSL="true"
npm run db:migrate
```

Expected result:
- the command exits successfully
- the target database now has the Phase 1 backbone tables

Important:
- this command applies the existing SQL migrations in `drizzle/`
- it does not generate new migrations

## 3. Bootstrap Pilot Records

Set placeholder example values for the pilot branch:

```bash
export DATABASE_URL="<railway-postgres-url>"
export DATABASE_SSL="true"
export TENANT_SLUG="<tenant-slug>"
export TENANT_NAME="<tenant-name>"
export TENANT_TIMEZONE_DEFAULT="<tenant-timezone>"
export TENANT_STATUS="active"
export BRANCH_SLUG="<branch-slug>"
export BRANCH_NAME="<branch-name>"
export BRANCH_TIMEZONE="<branch-timezone>"
export BRANCH_STATUS="active"
export SMARTMOVING_API_BASE_URL="<smartmoving-api-base-url>"
export SMARTMOVING_API_KEY_SECRET_REF="<api-key-secret-ref-name>"
export SMARTMOVING_WEBHOOK_SECRET_REF="<webhook-secret-ref-name>"
export SMARTMOVING_ONBOARDING_STATUS="pending"
npm run bootstrap:smartmoving-branch
```

Expected result:
- the script exits successfully
- it prints a concise summary including the tenant slug, branch slug, and onboarding status
- rerunning the same command updates the same tenant, branch, and connection rows instead of creating duplicates

## 4. Configure Hosted API Env

Before testing ingress, confirm the deployed API service has:

```bash
DATABASE_URL="<railway-postgres-url>"
DATABASE_SSL="true"
<SMARTMOVING_WEBHOOK_SECRET_REF>="<webhook-secret-value>"
```

Notes:
- `<SMARTMOVING_WEBHOOK_SECRET_REF>` must exactly match the ref string stored by the bootstrap step
- the bootstrap script stores secret refs only, never secret values

## 5. Manual Webhook Tests

Set local placeholders for the deployed API test:

```bash
export API_BASE_URL="<deployed-api-base-url>"
export TENANT_SLUG="<tenant-slug>"
export BRANCH_SLUG="<branch-slug>"
export WEBHOOK_SECRET_VALUE="<webhook-secret-value>"
```

### Expected `404` for unknown tenant or branch

```bash
curl -i \
  -X POST "$API_BASE_URL/webhook/smartmoving/unknown-tenant/unknown-branch" \
  -H "content-type: application/json" \
  -d '{"event-type":"placeholder"}'
```

Expected:
- `404`
- JSON body with:
  - `ok: false`
  - `status: "not_found"`

### Expected `503` if integration is not configured

This should happen if the tenant and branch exist but either:
- there is no `smartmoving_connection` row, or
- the deployed API is missing the runtime secret env var named by `SMARTMOVING_WEBHOOK_SECRET_REF`

Expected:
- `503`
- JSON body with:
  - `ok: false`
  - `status: "integration_not_configured"`

### Expected `401` for invalid auth

```bash
curl -i \
  -X POST "$API_BASE_URL/webhook/smartmoving/$TENANT_SLUG/$BRANCH_SLUG" \
  -H "content-type: application/json" \
  -H "x-smartmoving-auth: wrong-placeholder-secret" \
  -d '{"event-type":"placeholder"}'
```

Expected:
- `401`
- JSON body with:
  - `ok: false`
  - `status: "unauthorized"`
- the API persists a `raw_webhook_event` with `auth_result = "rejected_invalid_auth"`

### Expected `202` for accepted raw ingress

```bash
curl -i \
  -X POST "$API_BASE_URL/webhook/smartmoving/$TENANT_SLUG/$BRANCH_SLUG" \
  -H "content-type: application/json" \
  -H "x-smartmoving-auth: $WEBHOOK_SECRET_VALUE" \
  -d '{"event-type":"placeholder"}'
```

Expected:
- `202`
- JSON body with:
  - `ok: true`
  - `status: "accepted"`
  - `rawEventId`
- the API persists a `raw_webhook_event` with `auth_result = "accepted"`

## 6. Smoke-Test Checklist

Confirm all of the following:
- migration command succeeds against Railway Postgres
- bootstrap command succeeds and is idempotent on rerun
- hosted API has the runtime secret env var named by the stored secret ref
- `404` works for an unknown path
- `401` works for a wrong auth header
- `202` works for the correct auth header

Stop after raw ingress verification.
- normalization, hydration, and queueing are intentionally out of scope for this smoke test
