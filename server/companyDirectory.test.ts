import { describe, expect, it, vi } from "vitest";
import { COMPANY_EMBEDDING_DIMENSIONS, embedCompanyProfiles, fetchOfficialCompanyDirectory } from "./companyDirectory";
import { normalizeOfficialCompanyRecords, officialRecordsToCsv } from "./profileImport";

const officialRecord = {
  name_EN: "Vector Company Ltd",
  name_TC: "向量公司",
  cluster: "Green Technology",
  introduction_EN: "AI energy analytics for commercial buildings.",
  product_EN: "Energy intelligence platform",
  website: "https://example.com",
};

describe("official HKSTP company directory processing", () => {
  it("accepts the official value-array response and creates stable company records and CSV", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ value: [officialRecord] }), { status: 200 }));
    const records = await fetchOfficialCompanyDirectory(fetcher as typeof fetch);
    const csv = officialRecordsToCsv(records);
    const normalized = normalizeOfficialCompanyRecords(records, "batch-1");

    expect(records).toHaveLength(1);
    expect(csv).toContain("Vector Company Ltd");
    expect(normalized[0]).toMatchObject({ sourceType: "company", name: "Vector Company Ltd", sector: "Green Technology", importBatchId: "batch-1" });
    expect(normalized[0]?.id).toMatch(/^company-/);
  });

  it("rejects malformed official responses", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ wrong: [] }), { status: 200 }));
    await expect(fetchOfficialCompanyDirectory(fetcher as typeof fetch)).rejects.toThrow("value array");
  });

  it("accepts ordered fixed-dimension vectors returned by OpenRouter", async () => {
    const originalKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key";
    const fakeVector = Array.from({ length: COMPANY_EMBEDDING_DIMENSIONS }, () => 0.001);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{ index: 0, embedding: fakeVector }] }), { status: 200 }));
    const companies = normalizeOfficialCompanyRecords([officialRecord], "batch-1");
    const embeddings = await embedCompanyProfiles(companies, "batch-1", fetcher as typeof fetch);

    expect(embeddings).toHaveLength(1);
    expect(JSON.parse(embeddings[0]!.embedding)).toHaveLength(COMPANY_EMBEDDING_DIMENSIONS);
    process.env.OPENROUTER_API_KEY = originalKey;
  });
});
