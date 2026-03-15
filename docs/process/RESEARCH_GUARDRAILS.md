# Research Guardrails

Purpose:
- prevent planning errors caused by incomplete source coverage
- force explicit separation of confirmed facts, inferences, and unknowns
- apply to all future architecture and product-scope decisions in this repo

## 1. Source Coverage Rule
Before making a planning conclusion about a third-party system, build a source inventory that includes:
- every user-supplied source
- the directly related official docs surface
- adjacent official surfaces that could answer the same business question

Example:
- if the question is about event-driven contact timing, do not stop at webhook and API docs
- also check official reporting/help surfaces for exported or derived timing fields

## 2. Negative Claim Rule
Do not say:
- `there is no way`
- `this is not available`
- `SmartMoving does not expose this`

Unless the relevant official source surfaces have been checked.

If coverage is incomplete, say:
- `not found in the sources checked so far`
- `not documented in the public API/webhook surface checked so far`

## 3. Claim Classification Rule
Every material architecture claim must be classified as one of:
- `Confirmed`
- `Inference`
- `Unknown`

If a claim affects product viability, metric integrity, or a major design choice, include the exact source used.

## 4. Decision Coverage Rule
Before locking a design decision, confirm the source coverage for the decision’s dependency.

Examples:
- Speed-to-Lead accuracy depends on real timestamped contact evidence
- near-real-time freshness depends on either triggerability or acceptable polling cost
- historical STL fallback depends on report availability and fields

If any dependency is unresolved, the design decision must be marked:
- `gated`
- `fallback`
- or `deferred`

## 5. Official Surface Expansion Rule
When the primary surface does not answer the question:
- expand once to adjacent official surfaces before concluding

Priority order:
1. developer/API docs
2. official help/support docs
3. official reporting docs
4. vendor support statements
5. live product testing

## 6. Source-of-Truth Update Rule
Whenever a new fact changes scope, feasibility, or architecture:
- update the source-of-truth document immediately
- update any now-stale architecture wording in the same pass

Do not leave corrected facts in chat only.

## 7. Open Questions Rule
If a question cannot be resolved from docs, log it explicitly as a testable question:
- what action must be performed
- what endpoint or surface must be inspected
- what result would confirm or falsify the assumption

## 8. Pre-Conclusion Checklist
Before giving a feasibility answer, confirm:
- all user-provided links were read
- adjacent official surfaces were checked if the first set was insufficient
- any negative claim is scoped to the surfaces actually checked
- any fallback path is evaluated for security, fragility, freshness, and cost
- any architecture doc affected by the finding has been updated

## 9. Reasoning-Level Guidance
Use Extra High reasoning when:
- source coverage is incomplete
- vendor behavior is ambiguous
- a claim could materially change V1 scope or architecture

It is safe to step down to High when:
- source hierarchy is stable
- core data-source decisions are frozen
- remaining work is schema design, implementation sequencing, or scoped build execution
