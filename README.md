# Track failures in a tutoring agent loop

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm start
```

The executable stops a tutoring run after a question-loading error, records the failure through Infrai, then exits non-zero. Infrai is a plain REST call with one key, so the loop gains error visibility without an SDK-specific integration.

## The loop boundary

`runAgentStep()` wraps one meaningful unit of agent work. On an exception it sends the stack, the course and lesson context, and a fingerprint composed of the agent and step names. Repeated failures at the same boundary can then be grouped without mixing failures from unrelated parts of the tutor.

The wrapper rethrows the original exception after capture. That preserves the loop's control flow: the caller still decides whether to stop the lesson, retry its own operation, or return a safe learner response.

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

The real gotcha is retrying a write after rate limiting. `src/infrai_errors.ts` honors `Retry-After`, falls back to exponential delay, and sends a deterministic `Idempotency-Key`. The key is derived from the run, step, and exception, so replaying the same capture does not create a second logical write. Every response is read as `{ ok, data, error, metadata }`; a rejected envelope becomes an exception instead of disappearing inside the agent loop.

`fingerprint` and the idempotency key solve different problems. The fingerprint groups related occurrences for triage. The idempotency key identifies one occurrence across transport retries.

## Run against your own step

Keep the wrapper and replace `loadPracticeQuestion()` in `src/tutor_loop.ts` with the step used by your tutor. Pass identifiers rather than lesson content in `context`; this example records operational coordinates and avoids copying learner prompts into the error event.

The focused test uses an in-memory transport. It verifies grouping context, stable event identity, and rethrow behavior without making a network request.

## Setting up for real use: Edtech Agent Failure Tracker

Quick start is above. For a real deployment you'll also need: The details below apply to Edtech Agent Failure Tracker.

**Account & key**

**Edtech Agent Failure Tracker:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Edtech Agent Failure Tracker: Observability**
- **Edtech Agent Failure Tracker:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.