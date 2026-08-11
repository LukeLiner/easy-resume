# Comprehensive Technical Analysis: Reactive Resume — Agent Subsystem

> Generated: 2026-08-11 | Analyzed directory: `packages/api/src/features/agent` (+ `apps/web/src/routes/agent` + `packages/db/src/schema/agent.ts`)

## Executive Summary

This document is a deep-dive analysis of the **Agent subsystem** of Reactive Resume, an open-source privacy-focused resume builder. The subsystem implements a "chat-to-edit" assistant: a user converses with an LLM, and the LLM modifies the active resume exclusively through JSON Patch (RFC 6902) operations applied via a tool call. Every patch is recorded as an immutable, snapshot-bearing `agent_action` row, giving the system native auditability and single-click rollback.

The backend is a feature module living under `packages/api/src/features/agent/`. It is built on oRPC (type-safe RPC), Drizzle ORM against PostgreSQL, and the Vercel AI SDK v5 (`ai` v7 with `ToolLoopAgent`/`stepCountIs` and `toUIMessageStream`). The frontend lives under `apps/web/src/routes/agent/` and uses `@ai-sdk/react`'s `useChat` to consume the SSE-style event stream produced by the backend.

Architecturally the subsystem is well-bounded and demonstrates several deliberate engineering patterns: a two-tier optimistic-locking scheme (run claims + resume version checks), UI/model data decoupling (provider metadata and `agent-attachment:` UI parts are stripped before reaching the model), and a draft-isolation model (in-place threads vs. cloned draft threads). The code is strongly typed, Zod-validated, and covered by a substantial test suite (`service.test.ts` alone is ~46 KB).

Scope note: This analysis focuses strictly on the Agent feature module, its Drizzle schema, and the web client that consumes it. It does not cover the broader resume/preview/PDF pipeline except where the Agent subsystem touches it (notably `packages/resume/src/patch.ts` and `notifyResumePatched`).

## 1. Project Overview (Subsystem Scope)

### 1.1 Purpose & Scope
The Agent subsystem provides an AI conversational assistant that edits resumes. It is not a generic chatbot — its only write capability is applying JSON Patches to a designated "working resume." It supports:
- Multi-turn conversations (threads)
- File attachments (text/image/pdf/audio) fed to the model as multimodal parts
- Live streaming of assistant reasoning and tool calls
- Per-action rollback (revert to a prior snapshot)
- Two thread modes: a standalone "AI Draft" thread (edits a clone) and an in-resume assistant (edits the source resume directly)

### 1.2 Repository Structure (relevant slice)
```
packages/api/src/features/agent/
  router.ts           # oRPC router assembly (re-exports)
  routing.ts          # sub-router wiring + tags/meta
  service.ts          # 44 KB core orchestration (agentService.*)
  threads.ts          # thread CRUD + working-resume creation
  messages.ts         # message send/stop/resume sub-service
  actions.ts          # action revert (rollback) orchestration
  tools.ts            # AI SDK tool definitions (apply_resume_patch, read_attachment, ask_user_question)
  runs.ts             # claim/clear active run (optimistic lock)
  streams.ts          # stream id generation/validation
  attachments.ts      # attachment persistence + linking
  resume.ts           # resume helpers (get/patch, normalize operations)
  *.test.ts           # service.test.ts, tools.test.ts, streams.test.ts, resume.test.ts
packages/db/src/schema/agent.ts   # 5 tables: ai_provider, agent_thread, agent_message, agent_attachment, agent_action
apps/web/src/routes/agent/        # frontend: route.tsx, $threadId.tsx, -components/agent-chat.tsx, -helpers/, -hooks/
```

### 1.3 Technology Stack
- **RPC**: oRPC (`@orpc/*`) with `protectedProcedure`, Zod DTOs
- **LLM runtime**: Vercel AI SDK v5 — `ai` v7 (`generateId`, `stepCountIs`, `toUIMessageStream`, `UIMessage`, `ToolLoopAgent`-style `createAgent`), providers: OpenAI, Google (`@ai-sdk/google`), Anthropic
- **DB**: Drizzle ORM + PostgreSQL
- **Frontend**: TanStack Start/Router, `@ai-sdk/react` `useChat`, Zustand (chat store), TanStack Query, Motion, `react-markdown`
- **Streaming transport**: oRPC event-iterator → `eventIteratorToUnproxiedDataStream` (`@orpc/client`) consumed by `useChat`

## 2. Architecture

### 2.1 High-Level Architecture
The subsystem follows a classic feature-module layering consistent with the rest of the repo: **router → service → Drizzle**. The AI reasoning loop is owned by the AI SDK; the service acts as the orchestrator that prepares model input, instantiates the agent, and persists outcomes.

```
                 ┌─────────────────────────────────────────────┐
  Web (useChat)  │  apps/web/src/routes/agent/*                │
                 └───────────────┬─────────────────────────────┘
                                 │ oRPC (event iterator stream)
                 ┌───────────────▼─────────────────────────────┐
  API            │  router.ts → routing.ts → service.ts         │
                 │    agentService.{threads,messages,actions}   │
                 │    createAgent() → ToolLoopAgent loop        │
                 │    tools: apply_resume_patch, read_attachment,│
                 │           ask_user_question                  │
                 └───┬───────────────┬───────────────┬──────────┘
                     │               │               │
              ┌──────▼─────┐  ┌──────▼──────┐  ┌─────▼──────┐
              │ Drizzle    │  │ packages/   │  │ AI SDK     │
              │ (5 tables) │  │ resume/patch│  │ (LLM call) │
              └────────────┘  └─────────────┘  └────────────┘
```

### 2.2 Component Breakdown

**`service.ts` (orchestrator)** — exposes `agentService` with three sub-objects: `threads`, `messages`, `actions`.
- `threads.create` / `get` / `list` / `update` / `delete` / `clear` / `archive`
- `messages.send` / `stop` / `resume`
- `actions.revert`
- Contains `createAgent()`, `buildAgentTools()`, `buildAgentInstructions()`, `applyResumePatch()`, `getOrCreateForResume()`, `createWorkingResume()`, `claimActiveAgentRun()` (re-exported), `toModelInputMessage()`, `buildAttachmentModelParts()`, `normalizeAgentResumePatchOperations()`.

**`threads.ts`** — thread CRUD. `createWorkingResume()` clones the source resume into a new "AI Draft" resume (`AI Draft` / `<source> (AI Draft)`). `getOrCreateForResume()` returns the in-place thread, relying on the unique partial index `agent_threads_active_in_place_unique` to dedupe via `onConflictDoNothing`.

**`messages.ts`** — the send/stop/resume flow lives here (delegates persistence + streaming to `service.ts`). `send` validates, claims a run, consumes message quota, persists the user message, attaches files, repairs legacy `ask_user_question` answers, converts to model messages, runs `agent.stream()`, and streams via `streamToEventIterator(toUIMessageStream({ onFinish, onError }))`.
- `stop` aborts the active run, optionally persisting a partial message with `canceled` status, guarded by `canceledRunsWithPersistedPartial` to avoid `onFinish` double-write.
- `resume` reconnects to an in-flight run (`resume: true`) for refresh/crash recovery.

**`actions.ts`** — `revert` reads the target action, takes the latest applied action's `appliedUpdatedAt` as the optimistic-lock baseline, then in a single DB transaction: (1) patches the resume to the stored `snapshotData` via `replace ""`, (2) marks all applied actions from the target onward as `rolled_back`. On `RESUME_VERSION_CONFLICT` it marks the action `conflicted` instead of throwing.

**`tools.ts`** — three AI SDK tools:
- `apply_resume_patch`: takes `{ title, summary, operations: JSONPatchOperation[] }`, normalizes paths, applies via `applyResumePatch`, returns a preview summary.
- `read_attachment`: reads a stored attachment (text truncated to 40K chars; errors for non-text), returns content to the model.
- `ask_user_question`: structured clarification questions (UI-rendered); answers flow back as a follow-up message.

**`runs.ts`** — `claimActiveAgentRun()` sets `activeRunId`/`activeStreamId` only where `activeRunId IS NULL` (optimistic lock; returns false if already claimed → service throws `CONFLICT`). `clearActiveAgentRunIfCurrent()` releases the lock on finish/cancel.

**`streams.ts`** — generates/validates stream ids (the SSE channel identifier).

**`attachments.ts`** — persists uploaded files to storage (`uploads/{userId}/agent/{threadId}/{id}-{filename}`), records `agent_attachment` rows, and links them to a message via `linkAttachmentsToMessage()`.

**`resume.ts`** — thin helpers over `resumeService`: `getResume`, `patchResume`, `notifyResumePatched`, plus `normalizeAgentResumePatchOperations()` which rewrites simplified section paths (e.g. `/experience/items/0/...`) → canonical `/sections/experience/items/0/...`.

### 2.3 Data Architecture
Five tables in `packages/db/src/schema/agent.ts`:
- **`ai_provider`** — user-supplied LLM credentials. API keys are **encrypted-at-rest** (`encryptedApiKey` + `apiKeySalt` + `apiKeyHash` for verification + `apiKeyPreview` for display). Never stored plaintext.
- **`agent_thread`** — conversation container: `sourceResumeId`, `workingResumeId`, `activeRunId`/`activeStreamId` (run lock), `archivedAt`/`deletedAt` (soft delete), `title`, `status`. The unique partial index `(userId, workingResumeId, sourceResumeId) WHERE status='active' AND deletedAt IS NULL` enforces at most one in-place thread.
- **`agent_message`** — `UIMessage`-shaped `uiMessage` JSONB, `sequence` (unique per thread), `status` (`completed`/`canceled`/`error`).
- **`agent_attachment`** — `storageKey`, `filename`, `mediaType`, `size`; optionally linked to a `messageId`.
- **`agent_action`** — the audit/rollback ledger: `kind` (`resume_patch`), `status` (`applied`/`rolled_back`/`conflicted`), `operations`, `snapshotData` (full `ResumeData` at apply time), `baseUpdatedAt`, `appliedUpdatedAt` (used as optimistic-lock token for revert).

### 2.4 API Surface
All RPC under `/api/rpc`, grouped as `agent` router with nested sub-routers `threads`, `messages`, `actions`. Representative procedures:
- `agent.threads.create` / `.get` / `.list` / `.update` / `.delete` / `.clear` / `.archive` / `.getOrCreateForResume`
- `agent.messages.send` / `.stop` / `.resume`
- `agent.actions.revert`

Auth: every procedure is a `protectedProcedure` (Better Auth session). Inputs validated by Zod DTOs.

## 3. Application Flows

### 3.1 Send a message (primary edit flow)
Trigger: user submits composer input in `agent-chat.tsx` → `useChat` → oRPC `agent.messages.send`.
1. `messages.send` validates thread (`archived`/`deleted`/`activeRunId` present → reject), resolves a runnable `aiProvider`, calls `claimActiveAgentRun` (optimistic lock, throws `CONFLICT` on contention).
2. If the message is an assistant tool-result echo → `updateAssistantToolResultMessage`. Otherwise it is a user turn: `consumeThreadMessageQuota`, `persistMessage`, `linkAttachmentsToMessage`, and (first message) updates `thread.title`.
3. `repairLegacyAskUserQuestionAnswers` normalizes old-format answers; `convertToModelMessages` + `buildAttachmentModelParts` build the model input. `toModelInputMessage` strips `agent-attachment:` UI parts and all `providerMetadata`.
4. `createAgent()` builds a `ToolLoopAgent` with `stopWhen: stepCountIs(30)` (`MAX_AGENT_STEPS`), tools from `buildAgentTools`, system prompt from `buildAgentInstructions`.
5. `agent.stream({ abortSignal })` runs the think→act→observe loop. Each `apply_resume_patch` call is persisted atomically (snapshot→patch→action) inside `applyResumePatch`.
6. `streamToEventIterator(toUIMessageStream({ onFinish, onError }))` emits UI chunks. `onFinish` persists the assistant message and `clearActiveAgentRunIfCurrent`. Failures route through `onError`.

### 3.2 Revert an action (rollback flow)
Trigger: user clicks revert on a patch card → `agent.actions.revert({ id })`.
1. Load the action; require `status='applied'`, `kind='resume_patch'`, non-null `snapshotData`.
2. Query the latest applied action's `appliedUpdatedAt` as the lock baseline.
3. DB transaction: `resumeService.patchInTransaction` → `replace ""` with `cloneResumeData(snapshotData)`, guarded by `expectedUpdatedAt = latestAction.appliedUpdatedAt`; then mark all applied actions `>= action.appliedUpdatedAt` as `rolled_back`.
4. `notifyResumePatched` pushes the change to the editor. On `RESUME_VERSION_CONFLICT`, mark the action `conflicted` (graceful, no throw).

### 3.3 Attachment ingestion flow
1. File uploaded client-side → `attachments` procedure persists to storage + `agent_attachment` row (before message send).
2. On send, `linkAttachmentsToMessage` associates them.
3. `buildAttachmentModelParts` routes by MIME: `text/*`/`json`/`markdown` → inline `text` (40K cap); `image/*` → `image`; `application/pdf`/`audio/*` → `file`; else instructs model to use `read_attachment`.

### 3.4 Stop / Resume flow (interruption & recovery)
- `stop`: abort the active run's `abortSignal`; optionally persist a `canceled` partial message; `canceledRunsWithPersistedPartial` set prevents `onFinish` from re-writing.
- `resume`: when the client reconnects with `activeRunId`, `useChat` replays the active run; `resume: true` lets a refresh survive a mid-stream disconnect and continue receiving chunks.

### 3.5 Thread creation: draft vs in-place
- Standalone chat → `createWorkingResume` clones source into an `AI Draft`; Agent edits the clone, user adopts later.
- In-resume assistant → `getOrCreateForResume` returns the unique in-place thread (`workingResumeId === sourceResumeId === resumeId`); edits apply live to the builder's resume, surfaced via `notifyResumePatched` subscription.

### 3.6 Additional Flows Reference
- **Quota enforcement**: `consumeThreadMessageQuota` (referenced in `messages.send`) limits messages per thread.
- **Provider selection**: `getRunnableProvider` resolves an enabled, tested `ai_provider` for the run.
- **Title generation**: first user message updates `thread.title` (likely inferred from content).
- **Frontend rendering**: `agent-chat.tsx` maps `UIMessage.parts` to `PatchToolCard` / markdown / attachment UI; revert and answer callbacks dispatch oRPC mutations.

## 4. Design Decisions & Trade-offs

- **JSON Patch as the only write channel**: Centralizes all resume mutation through one validated, auditable path. Trade-off: LLM must generate syntactically correct RFC 6902 ops; mitigated by `normalizeAgentResumePatchOperations` and strict Zod schemas.
- **Per-action snapshot + rollback**: `snapshotData` makes revert a single `replace` rather than inverse-patch computation — simple, idempotent, robust. Cost: storage growth per action (full `ResumeData` copy).
- **Two-tier optimistic locking**: run-level (`claimActiveAgentRun`) prevents concurrent runs on one thread; resume-level (`expectedUpdatedAt`) prevents stale reverts. Strong consistency at the cost of `CONFLICT`/`conflicted` states the UI must surface.
- **UI/model data decoupling**: stripping `providerMetadata` and `agent-attachment:` parts before model input keeps the model context clean and avoids leaking rendering concerns. Minor cost: re-derivation on the client.
- **Draft isolation**: separate in-place vs cloned-draft semantics avoid accidental edits while keeping one code path (`workingResumeId`).
- **Event-iterator streaming over oRPC**: type-safe streaming without a separate WebSocket; relies on `@orpc/client` + `useChat` compatibility.

## 5. Code Quality & Patterns

### 5.1 Code Organization & Conventions
- Strict feature-colocation: router/routing/service/threads/messages/actions/tools/runs/streams/attachments/resume each own one concern.
- Service object pattern (`agentService.threads/messages/actions`) groups procedures by domain.
- Follows repo conventions: named TS types for component props (frontend), export-map imports, `protectedProcedure`, Zod DTOs.

### 5.2 Type Safety & Validation
- All DTOs are Zod schemas; `agent_message.uiMessage` is typed `$type<AgentUiMessage>`; `agent_action.operations` typed `$type<StoredJsonPatchOperation[]>`.
- Patch operations are validated both at the tool boundary and by `normalizeAgentResumePatchOperations`.
- `RolledBackAction`/state enums are string literals enforced in schema (`applied`/`rolled_back`/`conflicted`).

### 5.3 Error Handling
- Centralized oRPC `ORPCError` (`BAD_REQUEST`, `CONFLICT`, `NOT_FOUND`, `RESUME_VERSION_CONFLICT`).
- Rollback conflicts are caught and downgraded to `conflicted` status rather than thrown to the user.
- `onError` in the stream maps failures to the client; partial-message persistence on cancel prevents data loss.

### 5.4 Dependency Management
- Workspace deps via package export maps (`@reactive-resume/db`, `@reactive-resume/resume`, `@reactive-resume/schema`, `@reactive-resume/utils`).
- AI SDK split into `ai`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/react` (v5).

## 6. Testing

### 6.1 Testing Strategy & Coverage
- `service.test.ts` (~46 KB) is the dominant suite — exercises threads, messages/send/stop/resume, actions/revert, tool application, normalization, and locking contention paths.
- `tools.test.ts` validates patch/attachment/ask-user-question tool behavior.
- `streams.test.ts` validates stream id generation/validation.
- `resume.test.ts` validates operation normalization.
- Tests use Vitest (`pnpm --filter @reactive-resume/api test`).

### 6.2 Test Patterns & Quality
- Heavy use of in-memory/fixture DB transactions and deterministic ids (`generateId`).
- Asserts both happy paths and conflict/rollback edge cases.

### 6.3 Testing Gaps
- Frontend `agent-chat.tsx` and `-helpers`/`-hooks` have no visible unit tests in this slice.
- No e2e covering SSE reconnect (`resume`) under real network failure.
- Provider integration (actual LLM calls) is presumably mocked, not validated against live APIs.

## 7. DevOps & Deployment
(Inherited from the broader app; not Agent-specific.)
- Single Docker image: `apps/server` mounts oRPC + serves built web; Agent RPC served at `/api/rpc`.
- Migrations generated via `dotenvx run -f .env.local -- pnpm db:generate` / `db:migrate`; `agent.ts` schema requires a migration.
- `pnpm check`, `pnpm typecheck`, `turbo boundaries`, `pnpm test` gate changes.
- No Agent-specific observability; relies on app-wide logging.

## 8. Security Considerations
- **Secrets**: AI provider API keys encrypted at rest (`encryptedApiKey`/`apiKeySalt`/`apiKeyHash`/`apiKeyPreview`); plaintext never stored.
- **Authz**: `protectedProcedure` on every procedure; all queries scoped by `userId`.
- **Input validation**: Zod DTOs + JSON Patch schema validation prevent arbitrary DB writes; `normalizeAgentResumePatchOperations` constrains paths to `/data/...` and forbids mutating `name` metadata.
- **Soft delete**: `deletedAt`/`archivedAt` prevent data loss; queries filter on these.
- **Quota**: `consumeThreadMessageQuota` bounds resource usage per thread.

## 9. Assessment

### 9.1 Strengths
- Clean feature isolation and single-responsibility files.
- Strong auditability/rollback via snapshot-per-action.
- Robust concurrency control (two-tier optimistic locking).
- Excellent test depth on the service layer.
- Privacy-first credentials handling (encrypted keys, per-user scoping).

### 9.2 Areas for Improvement
- Snapshot-per-action storage cost grows unbounded; consider periodic full snapshots + deltas, or retention policy (low effort, medium impact).
- Frontend Agent code lacks unit tests (medium effort, medium impact).
- `service.ts` is 44 KB — consider extracting the agent-loop orchestration from CRUD orchestration (medium effort, low/medium impact given current test coverage).
- No live-provider integration tests; drift risk if AI SDK changes tool-call shapes (medium effort, medium impact).

### 9.3 Risks & Technical Debt
- Reliance on AI SDK v5 beta-ish tool/stream shapes; `ToolLoopAgent`/`toUIMessageStream` API churn is a maintenance risk.
- `CONFLICT`/`conflicted` states require careful UI handling; a missed path could leave a thread "stuck" with a dangling `activeRunId` (mitigated by `clearActiveAgentRunIfCurrent` on finish).
- Snapshot bloat on long threads.

### 9.4 Recommendations
1. (Low/High) Add a snapshot retention/compaction policy to bound storage.
2. (Medium/Medium) Add unit tests for `agent-chat.tsx` revert/answer callbacks and `-helpers/chat-attachments`.
3. (Low/Medium) Introduce a stuck-run reaper (timeout based on `activeRunStartedAt`) to auto-clear orphaned `activeRunId`.
4. (Medium/Medium) Add a provider-contract test that asserts the tool-call/stream shape the service depends on, to catch AI SDK upgrades.

## Appendix
### A. File Tree (Agent subsystem, top levels)
```
packages/api/src/features/agent/
  router.ts  routing.ts  service.ts  threads.ts  messages.ts
  actions.ts  tools.ts  runs.ts  streams.ts  attachments.ts  resume.ts
  service.test.ts  tools.test.ts  streams.test.ts  resume.test.ts
packages/db/src/schema/agent.ts
apps/web/src/routes/agent/
  route.tsx  index.tsx  new.tsx  $threadId.tsx  $threadId.test.ts
  -components/agent-chat.tsx
  -helpers/  -hooks/
```

### B. Key Dependency Catalog
- `@orpc/server`, `@orpc/client` — RPC + streaming transport
- `ai` (v7), `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/react` — AI SDK v5
- `drizzle-orm` — data layer
- `@reactive-resume/db`, `@reactive-resume/resume`, `@reactive-resume/schema`, `@reactive-resume/utils` — workspace packages
- `@tanstack/react-query`, `@tanstack/react-router`, `motion/react`, `react-markdown` — frontend

### C. Key File Reference
| Concern | File |
|---------|------|
| Core orchestration | `packages/api/src/features/agent/service.ts` |
| Thread CRUD + draft creation | `packages/api/src/features/agent/threads.ts` |
| Send/stop/resume loop | `packages/api/src/features/agent/messages.ts` |
| Rollback | `packages/api/src/features/agent/actions.ts` |
| AI tools | `packages/api/src/features/agent/tools.ts` |
| Run lock | `packages/api/src/features/agent/runs.ts` |
| Stream ids | `packages/api/src/features/agent/streams.ts` |
| Attachments | `packages/api/src/features/agent/attachments.ts` |
| Resume patch helpers | `packages/api/src/features/agent/resume.ts` |
| Schema (5 tables) | `packages/db/src/schema/agent.ts` |
| Frontend chat UI | `apps/web/src/routes/agent/-components/agent-chat.tsx` |
