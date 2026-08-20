import { describe, expect, it } from "vitest";
import { normalizeCsvDataset, normalizeDatasetRecord, parseCsvDataset } from "./profileImport";

describe("profile dataset normalization", () => {
  it("maps the HKSTP company schema into a search-ready company profile", () => {
    const profile = normalizeDatasetRecord(
      "company",
      { name_EN: "Aster Labs", cluster: "Healthtech", introduction_EN: "Precision diagnostics", product_EN: "AI imaging" },
      0,
      "batch-1",
    );
    expect(profile.name).toBe("Aster Labs");
    expect(profile.sector).toBe("Healthtech");
    expect(profile.normalizedText).toContain("AI imaging");
  });

  it("parses quoted CSV rows and maps Chinese investor fields", () => {
    const records = parseCsvDataset('INVESTOR,主要投资领域,机构官网\n"Aurora Ventures","Climate, SaaS",https://aurora.example');
    const profile = normalizeCsvDataset("investor", 'INVESTOR,主要投资领域,机构官网\n"Aurora Ventures","Climate, SaaS",https://aurora.example', "batch-2")[0];
    expect(records).toHaveLength(1);
    expect(profile?.name).toBe("Aurora Ventures");
    expect(profile?.investmentFocus).toBe("Climate, SaaS");
  });
});
