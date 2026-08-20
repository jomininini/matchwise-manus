import { describe, expect, it } from "vitest";
import { chooseCandidatePool, oppositeTypes } from "./matching";

const profile = (id: string, sourceType: "company" | "investor", normalizedText: string) => ({
  id,
  sourceType,
  recordKey: id,
  name: id,
  website: null,
  sector: null,
  stage: null,
  technology: null,
  description: null,
  investmentFocus: null,
  ticketSize: null,
  portfolio: null,
  normalizedText,
  rawData: {},
  importBatchId: "test",
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("matching candidate selection", () => {
  it("prioritizes candidates with meaningful shared domain language", () => {
    const candidates = [
      profile("climate", "investor", "Climate technology, decarbonisation and energy transition investments"),
      profile("retail", "investor", "Consumer retail brands and marketplace investments"),
    ];
    const results = chooseCandidatePool("AI platform for renewable energy monitoring and decarbonisation", candidates);
    expect(results[0]?.profile.id).toBe("climate");
  });

  it("maps investor comparisons to startup candidates and vice versa", () => {
    expect(oppositeTypes("investor")).toEqual(["company"]);
    expect(oppositeTypes("company")).toEqual(["investor"]);
  });
});
