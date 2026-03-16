# 1CC Command Center Module Priority Map

Last updated: March 15, 2026

Purpose:
- rank candidate modules by what SmartMoving data is actually proven today
- separate ship-now modules from report-gated modules
- distinguish client-facing modules from internal 1CC operations modules

This document should be read alongside:
- [SMARTMOVING_INTEGRATION_SOURCE_OF_TRUTH.md](/Users/admin/Documents/OpenAI%20Codex%20Projects/1cc-command-center/docs/architecture/SMARTMOVING_INTEGRATION_SOURCE_OF_TRUTH.md)
- [1CC_COMMAND_CENTER_V1_ARCHITECTURE_PLAN.md](/Users/admin/Documents/OpenAI%20Codex%20Projects/1cc-command-center/docs/architecture/1CC_COMMAND_CENTER_V1_ARCHITECTURE_PLAN.md)

## 1. Current Planning Decision
`Speed-to-Lead` remains strategically important, but exact STL should currently be treated as report-dependent.

Reason:
- live webhook testing proved real delivery
- live hydration proved opportunity details are readable
- live audit testing proved status and assignment timing is readable
- live communication testing still collapsed call, text, and email activity into generic `opportunity-changed`
- tested public API reads still did not expose a clean communication timestamp

Operational consequence:
- do not block the entire product on exact STL
- prioritize modules that fit the proven webhook + hydration + audit reality

## 2. Module Tiers
### Tier 1: shipable from proven data
These fit the data we have already validated in live testing.

#### A. Follow-Up Board
Purpose:
- show follow-ups due today ordered from nearest due time to furthest

Core columns:
- assignee
- company
- branch
- lead or quote
- due time
- completed state

Why it fits now:
- follow-up reads are real
- exact communication timing is not required
- the module is operationally useful for both clients and internal 1CC staff

Best audience:
- internal 1CC operator app first
- then client app by tenant and branch scope

#### B. Lead Flow Board
Purpose:
- show newly created leads and current queue state transitions

Core signals:
- `opportunity-created`
- `opportunity-status-changed`
- hydrated status
- lead status
- assignee

Why it fits now:
- webhooks and hydration already prove this state model
- audit adds status transition explanations

Best audience:
- client app and internal app

#### C. Assignment and Ownership Monitor
Purpose:
- show who owns what and when reassignment happened

Core signals:
- hydrated `salesAssignee`
- audit entries such as reassignment

Why it fits now:
- assignment timing is visible in audit
- ownership is clear in hydrated opportunity state

Best audience:
- client managers and internal 1CC operators

#### D. Reactivation and Status Watch
Purpose:
- surface reopened opportunities, major status transitions, and recovered pipeline items

Core signals:
- reopened opportunity audit entries
- status transitions
- generic change signals followed by hydration

Why it fits now:
- live reopened-opportunity testing already proved this

Best audience:
- client managers and internal 1CC operators

#### E. Integration and Queue Health
Purpose:
- monitor webhook delivery, duplicate bursts, hydration failures, and stale client heartbeats

Why it fits now:
- fully within the system we control
- high operational value

Best audience:
- internal 1CC app first

### Tier 2: viable, but with implementation work on top of proven data
These are still feasible without report ingestion, but they require more backend logic and product shaping.

#### A. Stale Pipeline Monitor
Purpose:
- identify items that have not progressed in status or ownership for too long

Need:
- stable projection timestamps
- branch-level timing rules

Best audience:
- client managers and internal 1CC operators

#### B. Booking and Loss Funnel
Purpose:
- show flow by status movement and rep

Need:
- status transition projection history
- branch-scoped aggregation

Best audience:
- client managers and internal 1CC operators

#### C. Activity Feed / Timeline
Purpose:
- provide a readable event stream per opportunity or rep

Need:
- normalized event catalog
- audit enrichment

Best audience:
- both shells

### Tier 3: gated by report ingestion or a newly proven API surface
These should not be treated as ship-now unless the data source changes.

#### A. Exact Speed-to-Lead
Definition:
- created at source to first valid outbound attempt

Why gated:
- recent live tests still did not expose call/text/email timestamps through the public API surfaces we tested

Likely source:
- report ingestion
- or a newly confirmed SmartMoving API/report surface

#### B. Awaiting First Contact
Purpose:
- show items with no valid first outbound attempt yet

Why gated:
- depends on knowing whether a communication attempt actually happened

Likely source:
- same as exact STL

#### C. Rep STL Leaderboards
Why gated:
- depends on exact STL facts being trustworthy

## 3. Client App vs Internal 1CC App
### Shared shell rule
Both shells should inherit the same tree-style scope/filter system so users can scale from personal focus to broad oversight without learning a second navigation model.

Recommended shell controls:
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
- assignee filter

### Client app should emphasize
- tenant-scoped lead flow
- assignment and ownership
- status transitions
- follow-ups due for that company and branch
- local operational visibility

Best default preset:
- `Focused`

### Internal 1CC app should emphasize
- cross-company follow-up board
- cross-tenant queue watch
- integration health
- exception handling
- later, report-driven STL oversight across accounts

Best default preset:
- `Command`

## 4. Recommended Roadmap
### Next build focus
1. Finish normalization, queueing, and projection logic for webhook-driven opportunity state.
2. Build the reusable backend projection model for:
   - created lead
   - current status
   - assignee
   - last changed time
3. Use that backbone to support:
   - Lead Flow Board
   - Assignment and Ownership Monitor
   - Reactivation and Status Watch

### Strongest next module candidate
`Follow-Up Board`

Reason:
- it solves a real daily operations problem
- it fits both client and internal 1CC use cases
- it does not depend on solving exact communication timestamps first

### Parallel research track
Research report ingestion for exact STL:
- scheduled report export
- browser-agent retrieval
- manual upload fallback

Do not let this research block the broader command center backbone.

## 5. Current Product Stance
Recommended external posture:
- do not market exact STL as delivered until the report path or another clean source is proven
- do market the command center as a live operational surface for lead flow, assignment, follow-up workload, and pipeline movement

Recommended internal posture:
- treat exact STL as a report-backed analytics layer
- treat follow-up and queue intelligence as the strongest operational product surface available now
