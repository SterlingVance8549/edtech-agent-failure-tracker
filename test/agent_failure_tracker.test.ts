import assert from "node:assert/strict";
import test from "node:test";
import { runAgentStep } from "../src/agent_failure_tracker.ts";
import type { ErrorCapture, ErrorTransport } from "../src/infrai_errors.ts";

test("captures one grouped failure and rethrows the original error", async () => {
  const captured: Array<{ payload: ErrorCapture; key: string }> = [];
  const errors: ErrorTransport = {
    async capture(payload, key) {
      captured.push({ payload, key });
      return { event_id: "event-1" };
    },
  };
  const failure = new Error("rubric service returned an empty rubric");

  await assert.rejects(
    runAgentStep(
      errors,
      "run-42",
      "essay-coach",
      "load-rubric",
      { courseId: "writing-2", lessonId: "argument", learnerId: "learner-7" },
      async () => { throw failure; },
    ),
    (error) => error === failure,
  );

  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0].payload.fingerprint, ["essay-coach", "load-rubric"]);
  assert.equal(captured[0].payload.context.runId, "run-42");
  assert.match(captured[0].payload.exception, /rubric service returned an empty rubric/);
  assert.match(captured[0].key, /^[a-f0-9]{64}$/);
});
