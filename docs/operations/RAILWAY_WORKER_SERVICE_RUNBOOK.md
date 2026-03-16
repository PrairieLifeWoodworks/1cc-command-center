# Railway Worker Service Runbook

Purpose:
- run `apps/worker` as a separate Railway service
- keep the existing API Railway service unchanged
- document the minimum command and env surface for the worker

Scope:
- worker process deployment only
- no API deployment changes
- no schema or feature changes

## 1. Current Config Constraint

The root [railway.json](/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/railway.json) remains API-specific:
- build command: `npm run build`
- start command: `node apps/api/dist/index.js`
- healthcheck path: `/health`

Do not repurpose the root `railway.json` for the worker service.

For the worker, create a separate Railway service from the same repo and override the service settings in Railway.

## 2. Worker Commands

Use:

```bash
Build Command: npm run build
Start Command: npm run start:worker
```

Root command added for the worker:

```bash
npm run start:worker
```

This starts:

```bash
node apps/worker/dist/index.js
```

## 3. Railway Worker Service Setup

Create a second Railway service in the existing project and point it at the same repo.

Configure the worker service with:
- Build Command: `npm run build`
- Start Command: `npm run start:worker`
- Public Networking: disabled
- Public Domain: none

Important:
- the worker is not an HTTP service
- if Railway prepopulates the API `/health` check from the root `railway.json`, remove or override that healthcheck for the worker service in Railway settings

## 4. Required Worker Env Vars

Required:
- `DATABASE_URL`

Optional but expected in Railway:
- `DATABASE_SSL`
- `NODE_ENV`
- `LOG_LEVEL`

SmartMoving credential requirement:
- the worker must have every env var referenced by `smartmoving_connection.api_key_secret_ref`
- for the current pilot branch, that means:
  - `SMARTMOVING_API_KEY_PRIORITY_MAIN_OFFICE`

Important distinction:
- `api_key_secret_ref` values are stored in the database
- the actual secret values must exist in Railway env vars with exactly those names

The worker does not require a public webhook secret to start hydration work.

## 5. Expected Worker Runtime Behavior

Once started, the worker should:
- connect to Postgres
- start the normalization queue consumer
- start the hydration queue consumer
- resolve SmartMoving API keys from env-backed secret refs at runtime

No public URL is expected for the worker service.

## 6. Deployment Readiness Checklist

Before enabling the worker service, confirm:
- `npm run build` succeeds locally
- Railway Postgres already has the latest migration applied
- the worker service start command is `npm run start:worker`
- the worker service has `DATABASE_URL`
- the worker service has any SmartMoving API key env vars referenced by existing branch connection rows
- the worker service does not expose a public domain
- the worker service does not rely on the API `/health` check

## 7. Next Live Verification

After the worker service is deployed:
- trigger or wait for a real SmartMoving webhook event
- verify the database shows:
  - `raw_webhook_event`
  - `normalized_event`
  - `hydrated_opportunity_snapshot`

That is the first live proof that the hosted worker path is functioning end to end.
