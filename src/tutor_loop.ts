import { runAgentStep } from "./agent_failure_tracker.ts";
import { createInfraiErrors } from "./infrai_errors.ts";

const errors = createInfraiErrors();
const lesson = {
  courseId: "algebra-1",
  lessonId: "linear-equations",
  learnerId: "learner-1042",
};

async function loadPracticeQuestion(): Promise<string> {
  throw new Error("question bank response did not contain a prompt");
}

try {
  await runAgentStep(
    errors,
    crypto.randomUUID(),
    "algebra-tutor",
    "load-practice-question",
    lesson,
    loadPracticeQuestion,
  );
} catch (error) {
  console.log("Agent failure captured; the loop stopped before producing a lesson response.");
  process.exitCode = 1;
}
