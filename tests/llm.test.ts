import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { runAgent } from "../src/pipeline/llm";

/*
 * runAgent()'s own 429/503 retry loop (src/pipeline/llm.ts) must own retry/backoff decisions: the AI
 * SDK's generateText() retries transient errors twice itself by default and then throws a RetryError,
 * which APICallError.isInstance() does not match, so generateText must be called with maxRetries: 0
 * (M4). These tests make a fake model throw APICallError directly (bypassing the SDK's own retry) and
 * assert the injected sleep is called with the Retry-After delay and the call eventually succeeds.
 */

const schema = z.object({ ok: z.boolean() });

function apiError(statusCode: number, retryAfterSeconds: string) {
  return new APICallError({
    statusCode,
    responseHeaders: { "retry-after": retryAfterSeconds },
    isRetryable: true,
    url: "x",
    requestBodyValues: {},
    message: statusCode === 429 ? "rate limited" : "service unavailable",
  });
}

function replyOk(): Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>> {
  return {
    content: [{ type: "text", text: JSON.stringify({ ok: true }) }],
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 5, text: 5, reasoning: 0 },
    },
    warnings: [],
  } as unknown as Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;
}

describe("runAgent 429/503 retry", () => {
  it("retries a 429 twice honoring Retry-After, then succeeds", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      modelId: "mock",
      doGenerate: async () => {
        calls++;
        if (calls <= 2) throw apiError(429, "1");
        return replyOk();
      },
    });
    const sleep = vi.fn(async () => {});

    const result = await runAgent({
      jobId: "job_test",
      agent: "test-agent",
      tier: "fast",
      model,
      schema,
      system: "You are a test agent.",
      prompt: "go",
      sleep,
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
  });

  it("retries a 503 with backoff, then succeeds", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      modelId: "mock",
      doGenerate: async () => {
        calls++;
        if (calls <= 2) throw apiError(503, "2");
        return replyOk();
      },
    });
    const sleep = vi.fn(async () => {});

    const result = await runAgent({
      jobId: "job_test",
      agent: "test-agent-2",
      tier: "fast",
      model,
      schema,
      system: "You are a test agent.",
      prompt: "go",
      sleep,
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toBe(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 2000);
    expect(sleep).toHaveBeenNthCalledWith(2, 2000);
  });

  it("turns a throwing check() into a repair note instead of an unhandled error", async () => {
    let calls = 0;
    const model = new MockLanguageModelV4({
      modelId: "mock",
      doGenerate: async () => {
        calls++;
        return replyOk();
      },
    });

    const result = await runAgent({
      jobId: "job_test",
      agent: "test-agent-3",
      tier: "fast",
      model,
      schema,
      system: "You are a test agent.",
      prompt: "go",
      maxRepairs: 1,
      check: (out) => {
        if (calls === 1) throw new Error("boom");
        return out.ok ? [] : ["not ok"];
      },
    });

    expect(result).toEqual({ ok: true });
    expect(calls).toBe(2); // first attempt's throwing check triggered a repair round
  });
});
