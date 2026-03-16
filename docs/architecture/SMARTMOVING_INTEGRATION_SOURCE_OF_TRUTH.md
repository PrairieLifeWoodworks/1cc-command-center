# SmartMoving Integration Source of Truth

Last validated: March 15, 2026

Purpose:
- provide the current operational and architectural source of truth for SmartMoving integration decisions in `1cc-command-center`
- separate confirmed facts from inference
- record known documentation gaps so V1 scope stays realistic

Research discipline:
- this document should be maintained using the checklist in [RESEARCH_GUARDRAILS.md](/Users/admin/Documents/OpenAI%20Codex%20Projects/1cc-command-center/docs/process/RESEARCH_GUARDRAILS.md)

Update rule:
- update this file when SmartMoving support clarifies behavior, official docs change, or observed production behavior contradicts this document

## 1. Source Set
### Official SmartMoving sources
- Webhook documentation:
  - [https://developer.smartmoving.com/webhook-document](https://developer.smartmoving.com/webhook-document)
- Developer portal home:
  - [https://developer.smartmoving.com/](https://developer.smartmoving.com/)
- Public API help article:
  - [https://help.smartmoving.com/en/articles/9739804-smartmoving-s-open-api](https://help.smartmoving.com/en/articles/9739804-smartmoving-s-open-api)
- Opportunity details operation:
  - [https://developer.smartmoving.com/api-details#api=public-api-v1&operation=get-api-opportunities-opportunityid](https://developer.smartmoving.com/api-details#api=public-api-v1&operation=get-api-opportunities-opportunityid)

### Official developer metadata retrieved from the SmartMoving developer portal
- API list metadata:
  - `https://developer.smartmoving.com/developer/apis?$top=50&$skip=0&skipWorkspaces=true&api-version=2022-04-01-preview`
- Public API operations metadata:
  - `https://developer.smartmoving.com/developer/apis/public-api-v1/operations?api-version=2022-04-01-preview`
- Opportunity details operation metadata:
  - `https://developer.smartmoving.com/developer/apis/public-api-v1/operations/get-api-opportunities-opportunityid?api-version=2022-04-01-preview`
- Public API schema bundle:
  - `https://developer.smartmoving.com/developer/apis/public-api-v1/schemas/69a7b010cfa7c516888ae8f5?api-version=2022-04-01-preview`
- Webhook events list feed used by the developer portal:
  - `https://smartmoving-prod-external-api.azurewebsites.net/api/external-document/webhook/events`

### Support statement provided by SmartMoving
Support explicitly said:
- they do not currently have a list of what triggers `opportunity changed`

That statement is operationally important and should be treated as a current documentation gap, not a temporary parsing issue on our side.

## 2. Confirmed Platform Facts
### Access tier requirements
From the help article:
- Basic tier is read-only, includes `20,000` monthly calls, and does not include webhooks
- Premium tier includes `125,000` monthly calls, full API access, and webhooks

Operational consequence:
- 1CC Command Center requires Premium if it depends on webhooks

### API authentication
From the developer portal metadata and help article:
- the public API uses `x-api-key` as the header auth mechanism
- the same key can also be passed as `api-key` query parameter

Operational consequence:
- branch integration records must store an API key reference
- all server-side hydration calls should use header auth, not query auth

### Webhook configuration
From the webhook documentation:
- webhooks are configured in SmartMoving at `Settings > Integrations > SmartMoving API > Webhooks`
- the webhook callback is a `POST`
- custom headers are supported
- multiple events can be sent to a single callback URL

Operational consequence:
- a per-branch shared secret in a custom header remains the correct ingress auth pattern for 1CC

## 3. Official Webhook Event List
The developer portal and its backing event feed currently list these supported events:

1. Opportunity Created
2. Opportunity Status Changed
3. Opportunity Changed
4. Opportunity Deleted
5. Follow up Created
6. Follow up Completed
7. Payment Made
8. Customer Created
9. Customer Updated
10. Job Deleted
11. Job Finalized
12. Job Closed
13. Job Created
14. Job Reset
15. Service Type Changed

Important notes:
- these are the official display names
- SmartMoving’s docs do not currently publish the exact machine-form event slugs for all events
- we have directly observed payload values including `opportunity-created`, `opportunity-changed`, and `opportunity-status-changed`
- treating the other event slugs as kebab-case equivalents would be an inference until observed in payloads

Operational consequence:
- keep an internal event catalog with both the official display name and the observed payload slug

## 4. Official Opportunity Status Codes
The public API schema documents `OpportunityStatus` as:

| Code | Name |
| --- | --- |
| `0` | `NewLead` |
| `1` | `LeadInProgress` |
| `3` | `Opportunity` |
| `4` | `Booked` |
| `10` | `Completed` |
| `11` | `Closed` |
| `20` | `Cancelled` |
| `30` | `Lost` |
| `50` | `BadLead` |

This confirms the earlier observed codes:
- `0` is not just a candidate "new" state; it is officially `NewLead`
- `3` is officially `Opportunity`
- `4` is officially `Booked`
- `30` is officially `Lost`

Operational consequence:
- status mapping can now move from provisional notes into configuration-backed application logic
- keep the mapping in config, not hard-coded constants spread across modules

## 5. Hydration Endpoints Confirmed as Useful
### Primary opportunity hydration
`GET /api/opportunities/{opportunityId}`

Confirmed response fields include:
- `id`
- `quoteNumber`
- `customer.name`
- `customer.emailAddress`
- `customer.phoneNumber`
- `branch.name`
- `contacts[]`
- `serviceDate`
- `status`
- `leadStatus`
- `salesAssignee.id`
- `salesAssignee.name`
- `jobs[]`
- `payments[]`
- `tasks[]`
- `tariff`

Confirmed optional query flags include:
- `IncludeTripInfo`
- `IncludePayments`
- `IncludeSurveys`
- `IncludeJobAddresses`
- `IncludeTasks`
- `IncludeFiles`
- `IncludePhotos`
- `IncludeDocuments`
- `IncludeCharges`
- `IncludeDispatchInfo`

### Secondary lookup by quote number
`GET /api/opportunities/quote/{quoteNumber}`

Operational use:
- convenient deep-link and reconciliation path when quote number is the operator-visible key

### Lead lookup
`GET /api/leads/{leadId}`

Confirmed fields include:
- `id`
- `customerName`
- `emailAddress`
- `phoneNumber`
- `serviceDate`
- `salesPersonId`
- `salesPerson`
- `branchId`
- `branchName`
- `createdAtUtc`

Operational use:
- useful only when a reliable lead ID is available
- current webhook observations still center on `opportunity-id`, not `leadId`

### Audit activity
`GET /api/opportunities/{opportunityId}/audit-activity`

Confirmed fields include:
- `id`
- `activityType`
- `description`
- `changeMadeByUserId`
- `createdAtUtc`

Confirmed enum:
- `0 = Created`
- `1 = Edited`
- `2 = Deleted`

Operational use:
- likely useful for change history and assignment evidence
- not yet proven as a reliable source for first outbound call, text, or email detection

## 6. What Is Still Undocumented or Weakly Documented
### Trigger semantics for generic opportunity events
Support explicitly stated they do not currently have a list of what triggers `opportunity changed`.

Operational consequence:
- `opportunity-changed` and likely some related events must be treated as generic invalidation signals
- internal event interpretation must be empirical and versioned

### Webhook payload schemas
The official webhook documentation publishes the supported event list and setup instructions, but not a full machine-readable payload schema catalog.

Operational consequence:
- continue storing raw webhook payloads
- keep a sanitized sample payload library by observed event type
- do not assume unobserved fields exist

### Exact event slugs
Official docs show event display names, not the exact payload strings for all events.

Operational consequence:
- preserve both display-name and observed-slug columns in the event catalog

### Lead statuses endpoint quality
The documented `GET /api/leads/statuses` operation currently resolves to an array of `LeadViewModel` in the published schema metadata, not an enum or status-list shape.

Operational consequence:
- treat this endpoint as documentation-noisy until verified against live responses
- do not build critical logic on the published contract for this endpoint alone

### Communication history read APIs
In the published public API operations metadata:
- there are documented `POST` endpoints to log calls and notes on an opportunity
- there is no clearly documented `GET` endpoint for reading call history, text history, or note history in a way that directly supports first-outbound-attempt detection

Operational consequence:
- exact Speed-to-Lead based on first outbound attempt is not fully proven from the public docs alone

### Adjacent signals that may help but do not prove a sent attempt
The published schemas do expose related workflow concepts:
- `FollowUpType` enum: `Email`, `Call`, `Text`, `Other`, `CMET`
- `GET /api/premium/opportunities/{opportunityId}/followups`
- `TaskItemType` enum: `PhoneCall`, `Email`, `Todo`
- `tasks[]` can be included on `GET /api/opportunities/{opportunityId}` with `IncludeTasks=true`

Operational consequence:
- these may support queueing, reminders, or proxy heuristics
- they do not, from the published contract alone, prove that an outbound call, text, or email was actually sent
- do not treat follow-ups or task items as definitive contact-attempt evidence until validated on live records

## 7. Live Validation Findings
### Real webhook delivery is proven
Observed live on the Railway production endpoint:
- `opportunity-created`
- `opportunity-status-changed`
- `opportunity-changed`

Observed payloads remained thin and centered on:
- `event-type`
- `opportunity-id`
- `opportunity-status`

Operational consequence:
- SmartMoving delivery itself is proven
- webhook traffic is reliable enough for the backbone
- payload thinness is confirmed in live operation, not just documentation

### Hydration is proven
Live `GET /api/opportunities/{opportunityId}` calls successfully returned:
- quote number
- customer details when available
- branch
- sales assignee
- service date
- status
- lead status

Operational consequence:
- hydration is a proven operational pattern

### Audit activity is useful for status and assignment changes
Live `GET /api/opportunities/{opportunityId}/audit-activity` calls successfully returned useful, timestamped entries such as:
- creation
- reassignment
- `Status changed to Lead in Progress from New Lead`
- `Lead status changed to #1`
- `Opportunity reopened`

Operational consequence:
- audit activity is a viable source for status and assignment timing
- audit activity improves operational explainability even if it does not solve communication timing

### Communication actions still collapse into generic change signals
In live tests:
- logged call activity triggered `opportunity-changed`
- sent text activity triggered `opportunity-changed`
- sent email activity triggered `opportunity-changed`
- with all webhook types enabled, no distinct communication-specific webhook family was observed

Operational consequence:
- communication-related actions are confirmed to generate webhook traffic
- that traffic still does not identify the communication channel in the payloads we observed

### Tested public read surfaces still do not expose a clean communication timestamp
In live tests:
- `audit-activity` did not show fresh explicit call/text/email entries for the recent actions we triggered
- `GET /api/premium/opportunities/{opportunityId}/followups` returned data in some cases, but did not surface the recent communication actions we were testing
- `tasks[]` with `IncludeTasks=true` returned empty arrays in the tested fresh-lead case

Operational consequence:
- exact first-contact timing remains unproven from the public API surfaces we tested
- the current best working conclusion is that SmartMoving tracks this internally for reporting, but the public API does not clearly expose it through the endpoints we exercised

### Follow-up board is still viable as a separate module
In live tests:
- `GET /api/premium/opportunities/{opportunityId}/followups` did return real follow-up records
- the returned follow-up shape includes:
  - id
  - opportunityId
  - type
  - title
  - assignedToId
  - dueDateTime
  - completedAtUtc
  - completed

Operational consequence:
- a due-follow-ups board is viable even if exact STL remains gated
- a future 1CC internal operations view can aggregate follow-ups across companies and branches if the necessary list/discovery strategy is implemented

## 8. Architecture Decisions Locked By These Findings
### Decision 1: webhook as trigger, API as truth
Locked.

Reason:
- official docs confirm broad webhook event coverage but not rich payload schemas
- official API docs confirm the opportunity details endpoint contains the business context we need

### Decision 2: dedupe before hydration
Locked.

Reason:
- webhook bursts were already observed in testing
- every hydration call consumes quota
- Premium still has a finite `125,000` request budget per month

### Decision 3: opportunity is the canonical source entity
Locked for V1.

Reason:
- current webhook observations are opportunity-centered
- the opportunity details endpoint is the richest documented read model
- lead-specific API reads are still useful, but not the best primary projection anchor

### Decision 4: raw event retention is mandatory
Locked.

Reason:
- trigger semantics and payload shapes remain incompletely documented
- replay and reinterpretation will be necessary as we learn more

### Decision 5: branch-scoped secrets and credentials
Locked.

Reason:
- multi-tenant and multi-branch are required
- webhook auth and API credentials must be isolated by branch integration config

### Decision 6: exact STL is report-dependent until proven otherwise
Locked for planning.

Reason:
- official help docs prove SmartMoving tracks `Time to Contact`, `Last Communication`, and related reporting dates
- live webhook behavior for call/text/email still collapsed into generic `opportunity-changed`
- live API reads tested so far did not expose clean communication timestamps

Operational consequence:
- exact Speed-to-Lead should be treated as gated and report-dependent unless SmartMoving confirms another public API surface
- backbone work can proceed without blocking on exact STL
- report ingestion or report-agent retrieval is now the leading fallback path for exact STL

## 9. Feasibility Assessment
### Feasible now
- hosted webhook relay
- raw event persistence
- normalization and dedupe
- opportunity hydration
- opportunity and lead-work-queue projections
- multi-tenant and multi-branch admin model
- desktop read-only widget with live updates
- company and personal views once completed facts are available
- webhook and heartbeat health monitoring

### Feasible with normal implementation risk
- assignment detection from hydrated opportunity snapshots
- status-based operational bucketing such as `Unassigned`
- deep links using opportunity ID and quote number
- business-hours-adjusted timing once branch calendars are configured

### Feasible only with a documented or observed communication read path
- exact Speed-to-Lead measurement defined as `created_at -> first valid outbound attempt`
- `Assigned Awaiting First Outbound Attempt` if the attempt event must be proven from SmartMoving data alone
- `Awaiting Contact`

Reason:
- the public docs currently do not prove a clean read endpoint for outbound communication history
- audit activity may help, but that is still an inference until validated against live data

### Scope judgement
The overall 1CC Command Center project remains feasible.

The risky part is not the platform backbone. The risky part is one business metric:
- precise first outbound attempt detection

That means:
- the desktop operational shell is feasible
- the webhook plus hydration backbone is feasible
- read-only multi-tenant delivery is feasible
- the Speed-to-Lead module is feasible if we confirm one reliable communication-history source
- if that source is not available, V1 should still ship with status and assignment-driven operational buckets, while exact outbound-attempt timing is either beta, partial, or deferred

## 10. Recommended V1 Guardrails
- keep the backend model as `webhook -> normalize -> dedupe -> hydrate -> project -> notify`
- budget API usage carefully because duplicate webhook bursts can multiply hydration calls
- treat `opportunity-changed` as a generic rehydrate signal, not a business event with stable semantics
- keep status-code mapping in configuration
- keep first-outbound-attempt logic behind a verification gate until we prove the source data
- do not promise `Awaiting Contact` in V1 until communication outcomes are confirmed from real payloads or API reads
- do not assume that enabling all webhook types will reveal communication-specific event families; live testing has already failed that assumption

## 11. Immediate Next Verification Work
1. Capture sanitized examples of every newly observed webhook event burst pattern for assignment, status change, and communication actions.
2. Determine whether SmartMoving exposes any undocumented or account-specific read endpoints for communication history.
3. Verify whether Lead Status report exports populate `Time to Contact` and `Last Communication` consistently for the tested quotes.
4. Confirm whether `leadStatus` in opportunity details is stable enough to support additional queue-state derivations.
5. Validate real response shape for `GET /api/leads/statuses`, because the published schema metadata looks incorrect.

## 12. Logged Open Questions For Speed-to-Lead Truth
These are not resolved by the public docs and should be answered through live tenant testing.

### Question 1: Are outbound contact attempts triggerable?
If a rep sends or logs a call, text, or email in SmartMoving:
- does that produce a webhook event we can subscribe to, or
- does it only become visible through a subsequent read such as audit activity, follow-ups, tasks, or another endpoint

Why this matters:
- trigger-driven detection keeps the metric near-real-time and cheap
- read-only discovery forces delayed detection or polling

### Question 2: Is communication evidence per-opportunity only?
Current public docs show opportunity-scoped reads such as:
- `GET /api/opportunities/{opportunityId}`
- `GET /api/opportunities/{opportunityId}/audit-activity`
- `GET /api/premium/opportunities/{opportunityId}/followups`

Current public docs do not show a general opportunities list endpoint.

Why this matters:
- if communication state can only be read per opportunity, then contact-attempt refreshes may require one call per tracked opportunity

### Question 3: Can lead list endpoints reduce scan cost?
Current public docs do show:
- `GET /api/leads`
- `GET /api/premium/leads/sales/{salesPersonId}`

But the published contracts do not prove that those lead list responses contain outbound communication state.

Why this matters:
- if lead list reads can identify newly attempted leads, we may avoid per-opportunity polling
- if not, they are useful for queue discovery but not attempt detection

### Question 4: Would V1 require periodic polling?
If outbound attempts are not webhook-triggered and not surfaced in list endpoints, then the likely fallback is:
- webhook-driven hydration for state changes
- targeted periodic polling only for active, non-terminal, no-attempt-yet queue items

Why this matters:
- this affects API quota, freshness, and implementation complexity
- polling every known opportunity all day is not acceptable as the default design

### Current working assumption
Until live tests prove otherwise, the safest architectural assumption is:
- use webhooks for coarse change detection
- hydrate immediately for event-driven state updates
- if contact-attempt data is only visible through per-opportunity reads, poll only the small active set of `Assigned Awaiting First Outbound Attempt` items on a controlled interval
- stop polling once an item gets a first valid attempt, is booked, is lost, or otherwise becomes terminal

### Polling feasibility note
Targeted polling is operationally feasible if all of the following are true:
- the active unresolved set is small
- the polling interval is controlled, such as every `15` or `30` minutes
- the contact-attempt read requires only one or a small number of endpoints per opportunity
- the read response includes the actual outbound attempt timestamp

Illustrative monthly volume:
- `5` active items polled every `15` minutes all day on `1` endpoint = about `14,400` calls per month
- `10` active items polled every `15` minutes all day on `1` endpoint = about `28,800` calls per month
- `10` active items polled every `30` minutes all day on `1` endpoint = about `14,400` calls per month

Important multiplier:
- if one polling pass requires `3` different endpoints per opportunity, then the monthly call volume is roughly tripled

Metric integrity rule:
- if polling returns the true communication event timestamp, Speed-to-Lead can still be computed exactly
- if polling only reveals that an attempt exists but not when it happened, then the system only knows the attempt occurred sometime between the previous poll and the current poll
- in that case the product must either mark the metric as approximate or not use that source for production-truth Speed-to-Lead

## 13. Report-Based Fallback Path
Official SmartMoving help content confirms two important facts:
- the `Lead Status` report includes `Quote #`, `Branch`, `Sales Person`, `Received At`, `Time to Contact`, and `Last Communication`
- SmartMoving’s enhanced reporting can export reports to Excel and can schedule report emails on `daily`, `weekly`, `bi-weekly`, or `monthly` cadence
- scheduled reports are managed per SmartMoving user

Implications:
- report ingestion is a real fallback path for historical and aggregate Speed-to-Lead
- official scheduled reporting, based on the current help article, does not appear to support hourly delivery
- if near-real-time report ingestion is needed, that would likely require custom automation rather than native scheduled reports

Fallback options in order of operational quality:
1. direct API or webhook-backed event detection
2. scheduled report export ingestion
3. manual report upload
4. browser-agent login and report scraping

Assessment of each:
- scheduled report ingestion
  - viable for historical truth and rolling averages
  - lower fragility than browser automation
  - one branch-level report may be enough because the report already includes salesperson identity
  - likely batch-oriented, not near-real-time
- manual upload
  - viable for pilot or backoffice workflows
  - highest operational friction
  - acceptable if positioned as an admin-assisted fallback
- browser-agent report scraping
  - technically feasible
  - highest fragility and security burden
  - requires credential storage, session handling, possible MFA handling, UI-change tolerance, download parsing, and support runbooks
  - should be treated as a contingency or bridge, not the preferred system backbone

Recommended use if this path is needed:
- use reports as an authoritative reconciliation source for completed contact metrics and averages
- keep webhook and API data for live queue state where possible
- let report imports correct or backfill facts when direct event-level contact timestamps are not available

## 13. Working Bottom Line
SmartMoving’s official documentation is now strong enough to support the backbone architecture for 1CC Command Center.

What is confirmed:
- webhook event families
- Premium requirement for webhooks
- API auth model
- opportunity status codes
- the primary hydration endpoint and its useful fields

What is still not confirmed:
- exact triggers behind generic change events
- a reliable documented read path for first outbound communication

That leaves the overall product viable, but it argues for disciplined V1 scope:
- ship the platform backbone and operational widget
- treat first-outbound-attempt logic as the one feature that must be verified before it is treated as production-truth
