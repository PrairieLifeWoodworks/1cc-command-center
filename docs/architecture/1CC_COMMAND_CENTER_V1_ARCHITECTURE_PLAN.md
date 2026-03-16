# 1CC Command Center V1 Architecture Plan

## 1. Executive Summary
1CC Command Center V1 should ship as a read-only, desktop-first operational product with a thin cloud backbone, not as a broad CRM rewrite. The correct backbone is a hosted webhook relay plus hydration service, a managed Postgres database for event history and current-state projections, an Electron desktop client for the operational widget, and an internal admin console for tenant, branch, entitlement, and health control.

For V1, keep the system simple:
- keep SmartMoving webhooks as triggers, not business truth
- hydrate business context from SmartMoving APIs after every meaningful event
- persist both append-only events and current projections
- push read-only updates to Electron clients over authenticated server-sent events
- model tenant and branch routing from day one

## 2. Assumptions
- SmartMoving webhook payloads will remain thin and may not include stable event IDs.
- SmartMoving API hydration can return enough opportunity data to resolve customer, quote number, assignee, status, and service date.
- Assignment changes can be derived from hydrated snapshots even when webhook payloads are generic.
- First outbound attempt detection may require a second SmartMoving API source beyond the opportunity details endpoint.
- SmartMoving onboarding remains partly manual, so branch setup must support generated webhook URLs, secrets, and checklist status.
- The existing Railway ingress should remain supported during rollout, even if V1 introduces tenant and branch specific paths.
- V1 metrics should default to a rolling 30-day window, with sample counts shown alongside averages.
- Electron local storage is cache only; the backend is the source of truth.

## 3. Recommended Architecture
### Cloud Backend
Run one backend codebase with two deploy targets:
- `api`: REST API, webhook ingress, auth/session endpoints, SSE stream, admin APIs
- `worker`: hydration jobs, projection updates, metric recomputation, replay jobs

Use a managed Postgres database as the primary store. Use Postgres-backed jobs for V1 so the team does not need Redis on day one. `pg-boss` or an equivalent Postgres job runner is sufficient.

Keep the current Railway footprint for the first production path:
- Railway-hosted public ingress/API service
- Railway worker service
- managed Postgres

### Desktop App
Use Electron with a small React renderer:
- main process for auto-update, notifications, local cache coordination, deep-link handling
- preload bridge for secure IPC
- renderer for widget UI and settings

The desktop app should treat the backend as authoritative:
- initial state via REST bootstrap
- live updates via SSE
- local SQLite cache for last-known projections, settings, and pending notification state

### Admin Console
Use a lightweight internal web app against the same backend APIs. It should be a control plane, not a customer-facing analytics product.

Admin responsibilities:
- tenant and branch setup
- SmartMoving integration config
- webhook URL and secret generation
- entitlements and kill switch control
- webhook and hydration health visibility
- desktop heartbeat visibility

### Realtime Transport
Use authenticated SSE for V1.

Reasoning:
- the desktop app is read-heavy and mostly needs one-way push
- SSE is simpler to operate than WebSockets behind hosted infrastructure
- reconnect semantics are straightforward
- heartbeats and client actions can use normal REST endpoints

Reserve WebSockets for a later phase if modules require bidirectional collaboration or sub-second interaction patterns.

### Storage Model
Use Postgres for:
- raw webhook events
- normalized events
- enriched snapshots
- current-state projections
- speed-to-lead facts
- tenant and branch configuration
- user memberships and entitlements
- desktop heartbeats
- replay and job metadata

Use local SQLite in Electron for:
- UI state
- last successful bootstrap payload
- recent activity cache
- muted notification preferences

### Observability Model
Instrument the backend around the actual operational risks:
- structured logs with `tenant_id`, `branch_id`, `entity_type`, `entity_id`, `event_id`, `dedupe_key`
- metrics for ingress count, auth failures, duplicate rate, hydration latency, retry count, projection lag, SSE connection count, heartbeat staleness
- error tracking for backend, worker, and Electron crashes
- admin health panels backed by the same metrics

## 4. Data Model
### Core Tenancy
- `tenant`
  - id, slug, name, status, timezone_default
  - has many branches, users, entitlements
- `branch`
  - id, tenant_id, slug, name, timezone, business_hours_json, closure_calendar_json, status
  - has one SmartMoving integration config
  - has many projections, facts, heartbeats
- `user`
  - id, email, display_name, status
  - can belong to many tenants and branches through memberships
- `user_membership`
  - user_id, tenant_id, branch_id nullable, role
  - resolves access scope inside desktop and admin
- `entitlement`
  - tenant_id, branch_id nullable, module_key, enabled, effective_from, effective_to
  - V1 module key is `speed_to_lead`

### Integration and Ingress
- `smartmoving_connection`
  - branch_id, api_base_url, credential_ref, webhook_secret_ref, onboarding_status, last_verified_at
  - stores references to secrets, not raw secrets in plain text
- `raw_webhook_event`
  - id, tenant_id, branch_id, source, received_at, headers_json, payload_json, payload_hash, auth_result
  - append-only
- `normalized_event`
  - id, raw_event_id, tenant_id, branch_id, received_at, raw_event_type, normalized_event_class, entity_type, entity_id, status_code_raw, dedupe_key, duplicate, normalization_version
  - one row per parsed inbound event
- `enriched_event`
  - id, normalized_event_id, entity_type, entity_id, hydrated_at, hydration_status, snapshot_json, snapshot_version
  - stores the API-derived state used to update projections

### Projections
- `opportunity_state_projection`
  - opportunity_id, tenant_id, branch_id, lead_id nullable, quote_number, customer_name, customer_email, customer_phone, sales_assignee_id nullable, sales_assignee_name nullable, service_date, status_code, status_label, created_at_source, updated_at_source, first_seen_at, last_hydrated_at, terminal_state, current_snapshot_json
  - canonical product view of the opportunity
- `lead_state_projection`
  - work_item_id, opportunity_id, lead_id nullable, tenant_id, branch_id, assignee_user_id nullable, assignee_name nullable, assignment_detected_at, created_at_source, first_valid_outbound_attempt_at nullable, first_attempt_channel nullable, first_attempt_actor nullable, current_bucket, raw_age_minutes, business_age_minutes, status_code, excluded_reason nullable
  - product queue projection used by Speed-to-Lead

### Facts and Client State
- `speed_to_lead_fact`
  - id, opportunity_id, tenant_id, branch_id, assignee_user_id nullable, created_at_source, assignment_detected_at nullable, first_valid_outbound_attempt_at, first_attempt_channel, raw_elapsed_seconds, business_elapsed_seconds, fact_status, fact_version
  - immutable measurement row once a first valid attempt is established
- `desktop_heartbeat`
  - id, user_id, tenant_id, branch_id, app_version, platform, mode, last_seen_at, last_event_cursor, notifications_enabled
  - powers health and presence views

### Relationship Rules
- tenant to branch is one-to-many
- branch to SmartMoving connection is one-to-one for V1
- raw webhook event to normalized event is one-to-one
- normalized event to enriched event is zero-or-one per hydration pass
- opportunity projection is keyed by SmartMoving opportunity ID
- lead projection is a product-layer queue record derived from the opportunity projection
- speed-to-lead facts are derived from lead projection state transitions, not from webhook payloads directly

## 5. Webhook Relay + Hydration Flow
### Ingress Auth Pattern
Use:
- `POST /webhook/smartmoving/:tenantSlug/:branchSlug`
- `x-smartmoving-auth: <branch-secret>`

For transition safety, keep the current legacy ingress path active as an alias for the pilot branch until the branch-specific URLs are provisioned.

Auth steps:
1. resolve tenant and branch from path
2. load branch integration config
3. compare the shared secret in constant time
4. reject with `401` and log to rejected-event storage if invalid
5. persist the raw event before downstream work if valid

### Normalized Event Envelope
Use a stable internal envelope:
- `event_id`
- `source`
- `tenant_id`
- `branch_id`
- `received_at`
- `raw_event_type`
- `normalized_event_class`
- `entity_type`
- `entity_id`
- `status_code_raw`
- `status_label_candidate`
- `payload_hash`
- `dedupe_key`
- `duplicate`
- `normalization_version`
- `raw_payload`

Recommended classes for V1:
- `opportunity_created`
- `opportunity_updated`
- `opportunity_status_changed`
- `lead_updated`
- `unknown`

### Dedupe Strategy
Because SmartMoving appears to emit bursts and may not provide stable event IDs, use a fingerprint plus a time window.

Dedupe key input:
- tenant_id
- branch_id
- raw_event_type
- entity_type
- entity_id
- status_code_raw if present
- canonicalized payload hash

Rules:
- persist every raw event
- mark a normalized event as duplicate if the same dedupe key was seen within the last 120 seconds
- skip hydration and projection writes for duplicates unless the previous hydration failed
- keep duplicate rows for audit and vendor-behavior analysis

### Hydration Triggers
Hydrate on every non-duplicate event that resolves one of:
- `opportunity_id`
- `lead_id`

V1 fetch order:
1. hydrate opportunity details by `opportunity_id`
2. if a reliable lead ID exists and a distinct lead endpoint is useful, hydrate lead details
3. if outbound-attempt detection lives elsewhere, fetch that activity source only for entities in active queue states

Hydration should be branch-aware because API credentials and data scope may differ per branch.

### Failure Handling
- raw event persistence must happen before normalization side effects
- normalization failures move to a review queue with the raw payload preserved
- hydration jobs retry with exponential backoff
- after the retry budget is exhausted, mark the event `hydration_failed`, surface it in admin, and allow manual replay
- projections are only updated from successful hydration results

### Replay Strategy
Support three replay paths:
1. replay raw events by time range or branch into the normalization and hydration pipeline
2. re-hydrate a single entity on demand from admin
3. backfill facts after rule changes by replaying enriched history into projection logic

Version projection logic and fact logic so replays can be audited against the logic version that created each row.

### Retention
- raw webhook events: 180 days hot in Postgres, then archive
- normalized and enriched event history: 180 days hot
- projections and facts: retain while tenant is active
- desktop heartbeats: 30 days
- rejected events: 30 days hot, longer only if needed for onboarding support

## 6. Speed-to-Lead Logic
### Base Definition
The primary measurement is:
- `created_at_source -> first_valid_outbound_attempt_at`

`created_at_source` should come from hydrated SmartMoving entity data when available. Only fall back to the first-seen webhook timestamp if source creation time is unavailable.

### Assignment Detection
Set `assignment_detected_at` when:
- the hydrated snapshot first shows a non-null sales assignee, or
- the assignee changes from one user to another

Assignment is not the start of the metric, but it gates what counts as a valid attempt.

### First Valid Outbound Attempt
A first attempt counts only if all conditions are true:
- channel is outbound call, outbound text, or outbound email
- timestamp is on or after `assignment_detected_at`
- actor is a human rep or a permitted manual send identity
- the activity is not clearly system-generated

Exclude:
- SmartMoving auto-email on lead creation
- inbound customer communication
- any communication before assignment

### Fact Creation
Create one `speed_to_lead_fact` when the first valid outbound attempt is found.

Store both:
- `raw_elapsed_seconds`
- `business_elapsed_seconds`

If later discovery finds an earlier valid attempt, write a new fact version and mark the old fact superseded rather than mutating history silently.

### Company Average
For V1, company average should be the arithmetic mean of completed facts for the selected branch over the rolling 30-day window. Always show:
- average
- sample count
- mode: raw or business-hours-adjusted

If the branch sample count is too low, show the count and suppress ranking-based language.

### Personal Average
Personal average is the arithmetic mean of completed facts attributed to the selected rep over the same rolling 30-day window.

Attribution rule:
- attribute the fact to the rep who owned the lead at the first valid outbound attempt

### Operational Buckets
- `Unassigned`
  - active lead projection
  - no assignee
  - no first valid outbound attempt
  - not terminal
- `Assigned Awaiting First Outbound Attempt`
  - active lead projection
  - assignee present
  - no first valid outbound attempt
  - not terminal
- `Awaiting Contact`
  - only ship if SmartMoving data can reliably distinguish attempted but not contacted

### Raw Mode
Raw timer uses wall-clock elapsed seconds between the source creation timestamp and the attempt timestamp, or `now` for unresolved bucket items.

### Business-Hours-Adjusted Mode
Business-hours timer uses the branch timezone and branch operating calendar.

Rules:
- count only minutes overlapping open business intervals
- exclude weekends unless the branch schedule marks them open
- subtract branch closures and holidays
- compute against the branch associated with the lead at the relevant time

For live bucket cards, compute current raw and business age from the same projection row so the toggle is instant in the client.

## 7. Desktop App Structure
### Shell Structure
Build a module-capable Electron shell with:
- auth bootstrap
- tenant and branch selector
- shell scope presets
- entitlement-aware module registry
- compact mode
- expanded mode
- settings modal

V1 loads one primary module:
- `speed_to_lead`

Strong candidate parallel or follow-on module:
- `follow_up_board`

Reason:
- exact STL is currently report-dependent
- live SmartMoving testing already proved that follow-up reads are real enough to support a due-work board
- this module fits both the client shell and the internal 1CC cross-account operations shell

### Scope and Filter Model
The shell should support a tree-style scope model so users can move from broad oversight to narrow execution without changing products.

Recommended scope tree:
- view preset
  - `Focused`
  - `Command`
- scope mode
  - `My Work`
  - `Team / Branch`
  - `All Companies`
- company
- branch
- module
- work-state filters
  - due now
  - due today
  - overdue
  - unassigned
  - reopened
  - lead in progress
- assignee filter
  - me
  - specific rep
  - all reps

Design rule:
- the scope/filter tree belongs to the shell, not to a single module
- each module should inherit the same filtering model so the product scales consistently across tenants and operator roles

### Shell Presets
`Focused` should default to:
- `My Work`
- assigned records only
- action-first lists
- minimal noise

`Command` should default to:
- `All Companies`
- cross-company oversight
- triage and escalation workflows
- internal 1CC operator use

### Compact Mode
Compact mode should behave like a persistent widget:
- company average
- personal average
- two required bucket counts
- connection and health badges
- lightweight activity strip

### Expanded Mode
Expanded mode adds:
- leaderboard
- detailed bucket lists
- recent activity feed
- branch selector
- raw versus business-hours toggle
- deeper health indicators

If `follow_up_board` is enabled, expanded mode should also support:
- due-today list ordered from nearest due time to furthest
- columns for assignee, company, branch, lead or quote, and due time
- company/branch aggregation for the internal 1CC operator view
- tenant-scoped view for client-facing deployments

### Settings and State Model
Persist locally:
- selected tenant and branch
- preferred mode and window size
- raw versus business-hours default
- notification preferences
- muted records

Load from backend:
- user profile
- memberships
- entitlements
- current projections
- branch settings that affect timing logic

### Notification Behavior
Notify only for actionable state changes:
- new unassigned lead
- lead assigned but aging without attempt
- webhook or connection health degraded if user has manager role

Use backend-sent event types and local cooldown rules so the app does not spam repeated duplicate alerts.

### Deep Link Behavior
Every list item and alert should open the relevant SmartMoving record in the system browser:
- primary target: opportunity detail
- secondary target when available: quote detail or lead detail

Deep links should come from backend-generated URLs so tenant and branch specific URL logic stays centralized.

### Future Module Expansion
Keep a simple module contract:
- module key
- entitlement key
- bootstrap endpoint
- SSE event namespace
- settings schema

That is enough for future modules without forcing a plugin framework in V1.

## 8. Admin Console Structure
The admin console should expose five narrow surfaces.

### Tenant and Branch Management
- create tenant
- create and edit branches
- define timezone, business hours, and closures
- track onboarding state

### Integration Management
- store SmartMoving credential references
- generate and rotate webhook URLs and secrets
- verify last successful webhook receipt
- verify last successful hydration

### Entitlement Management
- enable or disable modules by tenant or branch
- set user or role-level access where needed
- apply a tenant or branch kill switch

### Health Visibility
- last event received per branch
- rejected webhook count
- duplicate rate
- hydration failure queue
- projection lag
- stale desktop heartbeat count

### Support Actions
- replay branch events
- re-hydrate a single entity
- force desktop logout by tenant or branch
- pause notifications or access without deleting config

## 9. Phased Build Plan
### Phase 0: Discovery Hardening
Goal:
- lock the normalized event schema and prove the data sources needed for assignment and first outbound attempt detection

Outputs:
- sanitized webhook sample set by event type
- confirmed hydration endpoint list
- confirmed status map kept as config, not hard-coded
- event and projection schema spec

Exit criteria:
- one pilot tenant can be modeled end-to-end on paper without unknown required fields

### Phase 1: Relay Backbone
Goal:
- ship hosted ingress, raw persistence, normalization, dedupe, and hydration jobs

Outputs:
- webhook endpoints with per-branch auth
- raw and normalized event tables
- worker queue and retry flow
- opportunity projection updates

Exit criteria:
- non-duplicate webhook events produce a successful hydrated projection within an acceptable latency target

### Phase 2: Speed-to-Lead Engine
Goal:
- derive queue buckets and completed facts from projections

Outputs:
- assignment detection
- first outbound attempt detection
- raw and business-hours timer engine
- branch leaderboard and averages API

Exit criteria:
- pilot branch metrics reconcile against manual spot checks

### Phase 3: Desktop Client
Goal:
- deliver the operational widget experience

Outputs:
- Electron shell
- login and branch selection
- compact and expanded views
- SSE live updates
- notifications and SmartMoving deep links

Exit criteria:
- pilot reps and managers can run the desktop widget against live data without admin intervention

### Phase 4: Admin Surface
Goal:
- make onboarding and support operationally manageable

Outputs:
- tenant and branch configuration UI
- entitlements
- webhook and hydration health views
- replay and kill switch actions

Exit criteria:
- internal team can onboard and support branches without database edits

### Phase 5: Hardening and Ship
Goal:
- make V1 production-capable

Outputs:
- packaging and signing
- auto-update flow
- retention jobs
- alerting
- runbooks

Exit criteria:
- documented recovery path exists for ingress failures, hydration failures, and stale clients

## 10. Risks / Open Questions
- Uncertain webhook schemas
  - Response: persist every raw payload, version normalization logic, and maintain a review queue for unknown shapes.
- SmartMoving status and trigger documentation gaps
  - Response: use the confirmed opportunity status map from the integration source-of-truth document, keep mappings in configuration, and treat generic event trigger semantics as vendor-opaque.
- Lead versus opportunity ambiguity
  - Response: treat opportunity as the canonical source entity and derive a separate lead work-item projection for product logic.
- First outbound attempt detection quality
  - Response: do not finalize this metric until the exact SmartMoving activity source is verified; ship the bucketing engine first if needed.
- Branch timezone and business-hours correctness
  - Response: make branch schedule configuration explicit and store both raw and adjusted durations so discrepancies can be audited.
- Duplicate and bursty vendor events
  - Response: windowed dedupe for processing, full raw retention for audit.
- Manual onboarding burden
  - Response: admin console must include generated webhook URLs, secrets, checklist status, and recent verification timestamps.
- Over-building the desktop client
  - Response: keep V1 to one module, two shells, a small settings surface, and focused notifications.

## 11. Recommended Immediate Next Step
Run a focused Phase 0 proof for one pilot branch that answers the two remaining blocking questions:
- which exact SmartMoving API endpoint and fields reliably identify assignment changes
- which exact API source reliably identifies first outbound call, text, or email versus system-generated communication

Once that proof is captured, freeze:
- normalized event schema
- projection schema
- business-hours rules model

That is the point where implementation should start.
