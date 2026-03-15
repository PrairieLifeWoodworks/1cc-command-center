# Worker Bootstrap Message

Paste this as the first message to the build worker after setting its system prompt.

```md
Read these files first and do not start coding yet.

You are the build worker for `1cc-command-center`. The design/review agent has final say on architecture, SmartMoving interpretation, metric logic, fallback policy, and task acceptance.

Your job in this step:
1. Read the files below in order.
2. Ingest them as binding project context.
3. Return a concise summary of:
   - the V1 product shape
   - the current SmartMoving integration truths
   - the gated or unresolved areas
   - what you must not assume while building
4. Do not propose architecture changes unless you find a direct conflict in the documents.
5. Do not code yet.

Read in this order:
1. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/process/BUILD_WORKER_AGENT_PROMPT.md`
2. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/architecture/1CC_COMMAND_CENTER_V1_ARCHITECTURE_PLAN.md`
3. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/architecture/SMARTMOVING_INTEGRATION_SOURCE_OF_TRUTH.md`
4. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/process/RESEARCH_GUARDRAILS.md`
5. `/Users/admin/Documents/OpenAI Codex Projects/1cc-command-center/docs/context/1CC_COMMAND_CENTER_HANDOFF.md`

After reading, report back with:
- 5-10 bullets max
- no coding
- no refactors
- any contradictions or blockers called out explicitly
```
