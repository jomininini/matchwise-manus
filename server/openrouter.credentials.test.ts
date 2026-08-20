import { describe, expect, it } from "vitest";

describe("OpenRouter server credential", () => {
  it("authenticates against the lightweight model catalog endpoint", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    expect(apiKey, "OPENROUTER_API_KEY must be configured for Company Match embeddings").toBeTruthy();

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.ok, `OpenRouter catalog request failed with ${response.status}`).toBe(true);
    const payload = await response.json() as { data?: Array<{ id?: string }> };
    expect(payload.data?.length).toBeGreaterThan(0);
  }, 20_000);
});
