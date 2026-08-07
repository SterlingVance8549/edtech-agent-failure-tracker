import { createHash } from "node:crypto";
import type { ErrorTransport } from "./infrai_errors.ts";

type LessonContext = {
  courseId: string;
  lessonId: string;
  learnerId: string;
};

function failureId(runId: string, step: string, error: Error): string {
  return createHash("sha256")
    .update(`${runId}\0${step}\0${error.name}\0${error.message}`)
    .digest("hex");
}

export async function runAgentStep<T>(
  errors: ErrorTransport,
  runId: string,
  agent: string,
  step: string,
  lesson: LessonContext,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error(String(caught));
    const eventId = failureId(runId, step, error);
    await errors.capture(
      {
        title: `${agent}/${step} failed`,
        message: `${error.name}: ${error.message}`,
        level: "error",
        fingerprint: [agent, step],
        exception: error.stack ?? `${error.name}: ${error.message}`,
        context: { runId, agent, step, ...lesson },
      },
      eventId,
    );
    throw error;
  }
}
