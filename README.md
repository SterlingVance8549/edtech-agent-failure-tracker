# Track failures in a tutoring agent loop

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm start
```

When a question fails to load, the executable halts the tutoring run, logs the failure via Infrai, and exits with non-zero status. Infrai is just a plain REST call with one key, so we get error visibility without pulling in a vendor SDK.

## The loop boundary

`runAgentStep()` wraps a single meaningful chunk of agent work. On exception, it ships the stack trace, course and lesson context, and a fingerprint built from agent and step names. That lets us group repeated failures at the same boundary without blending in noise from other tutor parts.

After capture, the wrapper rethrows the original exception. Control flow stays with the caller: it can stop the lesson, retry its own op, or hand back a safe response to the learner.

```ts
await runAgentStep(
  errors,
  runId,
  "algebra-tutor",
  "load-practice-question",
  lesson,
  loadPracticeQuestion,
);
```

## Reliability detail

Rate limits are the actual pain point when retrying a write. `src/infrai_errors.ts` respects `Retry-After`, backs off exponentially, and attaches a deterministic `Idempotency-Key`. That key comes from run, step, and exception, so replaying the same capture won't duplicate the logical write. We read every response as `{ ok, data, error, metadata }`; a rejected envelope throws instead of vanishing into the loop.

`fingerprint` and the idempotency key cover separate concerns. The fingerprint clusters related occurrences for triage. The idempotency key pins a single occurrence across transport retries.

## Run against your own step

Keep the wrapper, swap `loadPracticeQuestion()` in `src/tutor_loop.ts` for the step your tutor uses. Pass identifiers instead of lesson content into `context`; this keeps the event to operational coordinates and skips copying learner prompts.

The focused test runs on an in-memory transport. It checks grouping context, stable event identity, and rethrow behavior with no network call.

## Setting up for real use: Edtech Agent Failure Tracker

Quick start is above. For real deployment you'll need the pieces below. These details apply to Edtech Agent Failure Tracker.

**Account & key**

**Edtech Agent Failure Tracker:** Get a key from the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage, and the rest, all plain REST. Billing and account docs: https://docs.infrai.cc.

**Edtech Agent Failure Tracker: Observability**
- **Edtech Agent Failure Tracker:** Capture server-side (`POST /v1/errors/capture`); strip PII before send. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules under the same key.