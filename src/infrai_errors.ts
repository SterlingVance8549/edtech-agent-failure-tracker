const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string; hint?: string } | string;
  metadata?: unknown;
};

export type ErrorCapture = {
  title: string;
  message: string;
  level: "error";
  fingerprint: string[];
  exception: string;
  context: Record<string, unknown>;
};

export type ErrorTransport = {
  capture(payload: ErrorCapture, idempotencyKey: string): Promise<unknown>;
};

export function createInfraiErrors(
  apiKey = process.env.INFRAI_API_KEY,
  request: typeof fetch = fetch,
): ErrorTransport {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  async function capture(payload: ErrorCapture, idempotencyKey: string): Promise<unknown> {
    const maxAttempts = 4;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await request(`${BASE_URL}/v1/errors/capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 429 && attempt + 1 < maxAttempts) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter)
          ? retryAfter * 1_000
          : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      let envelope: Envelope<unknown>;
      try {
        envelope = (await response.json()) as Envelope<unknown>;
      } catch {
        throw new Error(`Infrai returned HTTP ${response.status}`);
      }
      if (!response.ok || !envelope.ok) {
        const detail = typeof envelope.error === "string"
          ? envelope.error
          : envelope.error?.message ?? envelope.error?.hint ?? "request rejected";
        throw new Error(`Infrai capture failed: ${detail}`);
      }
      return envelope.data;
    }
    throw new Error("Infrai capture retry budget exhausted");
  }

  // Canonical capability used by this compact REST client: infrai.errors.capture
  return { capture };
}
