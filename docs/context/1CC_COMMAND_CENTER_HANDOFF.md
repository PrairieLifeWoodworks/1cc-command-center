# 1CC Command Center Handoff

## 1. Executive Summary
1CC Command Center is a desktop-first operational product for moving company sales teams using SmartMoving.

The first production module is `Speed-to-Lead` inside a desktop Electron shell. V1 is not a write-back CRM automation tool. It is a read-only, near-real-time operating surface backed by a cloud relay/admin backend.

Current architectural conclusion:
- SmartMoving webhooks are usable as real-time triggers.
- Observed webhook payloads are thin lifecycle notifications, not rich business snapshots.
- Rich details such as quote number, customer name, phone, and email should be fetched via SmartMoving API hydration after webhook receipt.
- The product must be multi-tenant and multi-branch from day one, even if rollout begins with one pilot tenant.

## 2. Product Scope
### 2.1 V1 Product Outcome
Ship a production-capable system made of:
- Electron desktop app for subscriber reps/managers
- Cloud relay/API backend
- Internal 1CC admin console

V1 user outcomes:
- sign in with 1CC credentials
- select tenant/company and branch
- see company speed-to-lead average
- see personal average vs company average
- see live operational buckets
- see leaderboard
- see webhook/app health
- receive near-real-time updates
- open the relevant SmartMoving record quickly

### 2.2 V1 Authority Model
Allowed in V1:
- observe webhook/API data
- compute metrics
- derive operational buckets
- notify on desktop
- deep link into SmartMoving

Not allowed in V1:
- mutate SmartMoving records
- auto-send texts/emails/calls
- reassign leads
- change statuses
- autonomous AI write actions

### 2.3 Product Boundaries
In scope early:
- SmartMoving webhooks
- SmartMoving API hydration
- 1CC auth/login
- tenant + branch model
- entitlements/subscriptions
- event normalization
- derived metrics store
- desktop app
- admin console
- app update path
- webhook/app health

Out of scope early:
- direct QubeSheets integration
- direct SMS/email/call provider integrations
- calendar/payments/docs integrations
- AI automation
- SmartMoving write-back actions

## 3. Confirmed SmartMoving Webhook State
### 3.1 Active Production Webhook Endpoint
Current live webhook ingress:
- `https://website-chatbot-backend-production-3c6e.up.railway.app/smartmoving/webhook/sm-ingress`

Ingress auth contract:
- header name: `x-smartmoving-auth`
- header value: `SMARTMOVING_WEBHOOK_INGRESS_TOKEN`

Current hosting state:
- Railway deployment is active and verified.
- Old Cloudflare tunnel path has been retired.
- Local `cloudflared` process has been stopped.
- Old tunnel DNS record was deleted.
- `1ccwebhooks.com` was preserved for possible future branded custom-domain use.

### 3.2 What Was Verified
Direct checks passed against Railway:
- `GET /health` -> `200` with `{ "ok": true, "status": "healthy" }`
- unauthenticated `POST /smartmoving/webhook/sm-ingress` -> `401`
- authenticated `POST /smartmoving/webhook/sm-ingress` -> `200`

### 3.3 Current Log Paths
Accepted events:
- `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/02_backend/logs/smartmoving_webhooks.jsonl`

Rejected events:
- `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/02_backend/logs/smartmoving_webhooks_rejected.jsonl`

## 4. What We Learned About SmartMoving Webhooks
### 4.1 Core Finding
Observed webhook payloads are thin notifications. They appear to be good for trigger detection, but not sufficient as the primary business payload.

Observed payload shape for live opportunity events:
- `event-type`
- `opportunity-id`
- `opportunity-status`

Observed missing fields in webhook payloads:
- customer name
- phone number
- email address
- quote/opportunity number
- detailed assignment data
- estimate document data
- rich booking data

### 4.2 Confirmed Observed Event Types
Observed live on Railway:
- `opportunity-created`
- `opportunity-changed`
- `opportunity-status-changed`

Observed behavior:
- SmartMoving often emits event bursts for one user action.
- Duplicate deliveries occur and are already being marked `duplicate: true` by current webhook dedupe logic.
- Some user actions replay earlier transitions rather than emitting a brand-new specialized event.

### 4.3 Provisional Status Code Mapping
Observed so far on one opportunity lifecycle:
- `status 0` -> initial/new opportunity state candidate
- `status 3` -> estimated / pre-booked active state candidate
- `status 4` -> booked candidate
- `status 30` -> lost candidate

These mappings are provisional until SmartMoving confirms the status code list.
Do not hard-bake them as canonical business truth yet.

### 4.4 Important Behavioral Conclusions
- Creating a lead in the tested flow surfaced as `opportunity-created`, not a distinct lead-created event.
- Assigning/grabbing the lead surfaced as `opportunity-changed`, still with a thin payload.
- Creating and sending an estimate surfaced as generic opportunity change/status signals, not an estimate-rich payload.
- Booking surfaced as generic opportunity status/update events.
- Losing surfaced as generic opportunity status/update events.
- Confirming a booked opportunity did not emit a distinct confirmed event in the tested path.

## 5. SmartMoving API Findings Relevant to Command Center
The repo already contains a bundled SmartMoving OpenAPI file:
- `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/02_backend/public-api-v1.json`

### 5.1 Important API Endpoints Identified
High-value hydration candidates:
- `GET /api/opportunities/{opportunityId}`
  - detailed opportunity info
  - includes `quoteNumber`
  - includes `customer`
  - includes `salesAssignee`
  - includes `serviceDate`
  - includes `status`
- `GET /api/opportunities/quote/{quoteNumber}`
  - fetch opportunity by quote number
- `GET /api/leads/{leadId}`
  - fetch lead by id
- `GET /api/premium/customers/search?searchQuery=...`
  - lookup customer by name/email/phone
- `GET /api/customers/{customerId}/opportunities`
  - list opportunities for customer

### 5.2 Important Data Shapes Confirmed in API Schema
`OpportunityDetailsViewModel` includes:
- `quoteNumber`
- `customer`
- `salesAssignee`
- `serviceDate`
- `status`
- `jobs`
- `referralSource`
- `tariff`
- `documents/files/tasks/photos` options

`OpportunityCustomerViewModel` includes:
- `name`
- `emailAddress`
- `phoneNumber`

Conclusion:
- Webhook -> API hydration is the correct design.
- The webhook gives the `opportunityId` trigger.
- The API provides the business payload needed for useful actions.

## 6. Command Center Architecture Direction
### 6.1 Source-of-Truth Model
Use a cloud backend and central database as the source of truth.
Local Electron storage is cache only.

### 6.2 Event Processing Model
Treat webhooks as interrupts, not business payloads.

Recommended flow:
1. receive webhook
2. validate auth
3. append raw event
4. normalize event
5. dedupe
6. trigger hydration fetch by `opportunityId` or `leadId`
7. save enriched event snapshot
8. update current entity projection
9. recompute metrics/buckets
10. push updates to desktop clients

### 6.3 Relay Pattern
Recommended internal event envelope:
- `source`
- `receivedAt`
- `rawEventType`
- `normalizedEventClass`
- `entityType`
- `entityId`
- `statusCodeRaw`
- `statusMeaning`
- `dedupeKey`
- `duplicate`
- `rawPayload`

Recommended enriched event record:
- all normalized webhook fields
- hydrated API snapshot
- `quoteNumber`
- customer name/phone/email
- assignment info
- service date
- current status
- tenant/branch routing metadata

### 6.4 Persistence Model
Keep both:
- append-only raw event store
- current-state projections

Suggested logical storage buckets:
- `raw_webhook_events`
- `enriched_entity_events`
- `opportunity_state_projection`
- `lead_state_projection`
- `speed_to_lead_facts`
- `tenant_branch_config`
- `desktop_heartbeats`
- `entitlements`

## 7. Core V1 Business Logic
### 7.1 Speed-to-Lead Definition
Measure:
- `record_created_at -> first_valid_outbound_attempt_at`

Do not measure:
- assignment -> first attempt
- successful contact only
- auto-generated system email

### 7.2 Valid First Attempt
Only count outbound contact after assignment:
- outbound call
- outbound text
- outbound email

Do not count:
- SmartMoving auto-email on lead creation
- any event before assignment
- inbound customer contact

### 7.3 Required V1 Operational Buckets
Must-have:
- `Unassigned`
- `Assigned Awaiting First Outbound Attempt`

Optional only if data supports it:
- `Awaiting Contact`

### 7.4 Business Hours Toggle
Support both:
- raw elapsed time
- business-hours-adjusted elapsed time

Business-hours-adjusted logic must support:
- timezone awareness
- branch-specific hours
- weekends
- closures

## 8. Multi-Tenant / Multi-Branch Requirements
This is required from day one.

Recommended routing shape:
- `https://relay.yourdomain.com/webhook/{tenantSlug}/{branchSlug}`

Desktop app must resolve:
- tenant
- branch
- user
- module entitlements

Admin console must support:
- tenant management
- branch management
- webhook URL/secret generation
- health visibility
- app heartbeat visibility
- kill switch
- entitlement management

## 9. Desktop App Shape
Desktop client should be Electron-based and preserve the approved UI look/feel.

Required surfaces/patterns:
- compact widget mode
- expanded mode
- health badges
- company average metric
- personal average metric
- lead bucket cards
- leaderboard
- activity feed
- settings modal
- branch selector
- raw vs business-hours toggle
- deep links into SmartMoving

Important constraint:
- preserve the approved React design reference as closely as possible
- this is a desktop operational widget, not a generic admin dashboard

## 10. Recommended V1 System Components
### 10.1 Cloud Backend
Needs:
- stable public webhook ingress
- auth verification
- raw event storage
- normalization
- API hydration worker
- derived metrics engine
- desktop push channel
- admin API
- entitlement enforcement

### 10.2 Desktop App
Needs:
- 1CC login
- tenant/branch selection
- near-real-time feed
- local cache
- settings
- notifications
- app version/update support

### 10.3 Admin Console
Needs:
- tenant management
- branch management
- module entitlements
- webhook health
- last event received
- heartbeat visibility
- disable access / kill switch

## 11. Major Open Questions / Risks
1. Exact SmartMoving webhook payload schemas are still being mapped.
2. Lead vs opportunity semantics may differ by SmartMoving workflow.
3. Some user actions may not emit specialized event names.
4. Status code meanings are still provisional pending SmartMoving confirmation.
5. First outbound attempt may require data beyond webhook payloads.
6. Awaiting Contact may not be reliable in V1 depending on data direction/outcome quality.
7. Multi-branch onboarding UX will matter because SmartMoving webhook setup may still be manual.

## 12. Immediate Next Work Items
1. Continue event catalog capture for additional SmartMoving event families.
2. Save one sanitized sample payload per unique observed event type.
3. Produce a confirmed status code table once SmartMoving replies.
4. Design the hydration worker around `opportunityId`/`leadId` lookups.
5. Define the normalized event schema.
6. Define current-state projections for opportunities and lead work-queue state.
7. Define Speed-to-Lead metric computation logic with business-hours adjustment.
8. Design tenant/branch entitlement and routing model.
9. Plan the Electron app shell and admin console surfaces.

## 13. Recommended Build Phases
### Phase 0 - Discovery Hardening
- finish webhook catalog
- confirm status codes
- validate hydration endpoints against live tenant data
- settle normalized event schema

### Phase 1 - Relay Backbone
- webhook ingress service
- auth + raw event persistence
- normalization + dedupe
- hydration worker
- current-state projections

### Phase 2 - Speed-to-Lead Computation
- assignment detection
- first valid outbound attempt logic
- raw/business-hours timer engine
- lead bucket derivation
- leaderboard facts

### Phase 3 - Desktop Client
- auth
- tenant/branch selection
- widget shell
- live metrics/cards/feed
- deep links
- desktop notifications

### Phase 4 - Admin Surface
- tenant/branch management
- entitlements
- health monitoring
- app heartbeat visibility
- kill switch

### Phase 5 - Product Hardening
- release packaging/signing
- auto-update path
- observability
- retention policies
- onboarding flow

## 14. Bottom-Line Architectural Decision
For 1CC Command Center, the right model is:
- SmartMoving webhook as thin real-time trigger
- SmartMoving API as hydration truth
- central event/projection backend as the product backbone
- Electron desktop app as the operational client
- admin console as internal control plane

Do not build the product assuming the webhook itself contains enough business context.
Build it assuming webhook -> hydrate -> project -> notify.
