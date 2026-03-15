# Prompt for 1CC Command Center Build Agent

You are taking over architecture and staged implementation planning for a new product in this repo: `1CC Command Center`.

Repo root:
- `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot`

Your first task is not to code blindly. Your first task is to produce a concrete, staged build plan and system design rooted in the product requirements and the verified SmartMoving webhook findings already established in this repo.

## Read First
Read these files first:
1. `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/01_blueprint/1CC_COMMAND_CENTER_HANDOFF.md`
2. `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/01_blueprint/MASTER_TAKEOVER_DOSSIER_FOR_CLAUDE.md`
3. `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/01_blueprint/checkpoint-handoff.md`
4. `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/02_backend/smartmoving_lead_server.js`
5. `/Users/admin/Documents/OpenAI Codex Projects/Website-Chatbot/02_backend/public-api-v1.json`

## Critical Context
This is a desktop-first operational product for SmartMoving-based moving company sales teams.

V1 is:
- Electron desktop app
- read-only with deep links/notifications
- multi-tenant and multi-branch from day one
- cloud relay/admin backend
- module-based shell
- first shipped module: `Speed-to-Lead`

Current verified SmartMoving webhook reality:
- webhooks are live and working on Railway
- observed webhook payloads are thin notifications, not rich business snapshots
- observed payloads contain things like:
  - `event-type`
  - `opportunity-id`
  - `opportunity-status`
- rich details such as quote number, customer name, email, phone, and assignment details appear to require SmartMoving API hydration
- therefore the correct architecture is:
  - webhook trigger -> normalize -> dedupe -> hydrate via API -> persist enriched event -> project current state -> notify desktop clients

Current active webhook path:
- `https://website-chatbot-backend-production-3c6e.up.railway.app/smartmoving/webhook/sm-ingress`

Do not redesign around local tunnels or local-only infrastructure.

## Product Requirements You Must Respect
- Preserve the approved desktop widget feel and visual direction.
- Do not turn this into a generic bloated dashboard.
- Build for module entitlements from day one.
- V1 does not mutate SmartMoving.
- V1 must support tenant/company + branch selection.
- V1 must support raw vs business-hours-adjusted timing.
- V1 must support at least these operational buckets:
  - Unassigned
  - Assigned Awaiting First Outbound Attempt
- Awaiting Contact is optional only if data quality supports it.

## Your Deliverables
Produce the following in order:

1. **System architecture recommendation**
- cloud backend shape
- desktop app shape
- admin console shape
- realtime transport choice
- storage model
- observability model

2. **Data model recommendation**
Define the major entities and relationships, including:
- tenant
- branch
- user
- entitlement
- raw webhook event
- normalized event
- enriched event
- opportunity state projection
- lead state projection
- speed-to-lead fact
- desktop heartbeat

3. **Webhook relay and hydration design**
Specify:
- ingress auth pattern
- normalized event envelope
- dedupe strategy
- hydration triggers by event/entity type
- failure handling
- replay strategy
- raw retention vs derived retention

4. **Speed-to-Lead computation design**
Define exactly how to compute:
- company average
- personal average
- unassigned bucket
- assigned awaiting first outbound attempt bucket
- raw mode
- business-hours-adjusted mode

5. **Desktop app module design**
Define:
- shell structure
- compact vs expanded mode behavior
- settings/state model
- notification behavior
- deep link behavior
- future module expansion path

6. **Admin console design**
Define:
- tenant/branch management
- entitlement management
- webhook health visibility
- app heartbeat visibility
- kill switch / disable access

7. **Phased implementation plan**
Give a realistic phased roadmap from discovery-complete to V1 shipped.
Do not propose a giant rewrite. Propose an implementation sequence that can actually ship.

8. **Risk register**
List the top risks and the design response to each.
Important risks include:
- uncertain webhook schemas
- provisional SmartMoving status codes
- lead vs opportunity ambiguity
- first outbound attempt detection quality
- branch/timezone/business-hours correctness

## Constraints
- Be pragmatic.
- Do not over-engineer V1.
- Do not assume webhook payloads contain all necessary detail.
- Do not assume SmartMoving setup can be fully automated.
- Prefer a stable hosted backend with managed DB.
- Keep the first build path realistic for a small team.

## Output Format
Return your response in this exact structure:
1. Executive Summary
2. Assumptions
3. Recommended Architecture
4. Data Model
5. Webhook Relay + Hydration Flow
6. Speed-to-Lead Logic
7. Desktop App Structure
8. Admin Console Structure
9. Phased Build Plan
10. Risks / Open Questions
11. Recommended Immediate Next Step

Do not start coding until the architecture and phased plan are coherent.
