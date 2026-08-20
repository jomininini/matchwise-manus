import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  browseProfiles: vi.fn(),
  getCompanyEmbeddingHashes: vi.fn(),
  getProfile: vi.fn(),
  getProfilesByIds: vi.fn(),
  isProfileSaved: vi.fn(),
  listDatasetImports: vi.fn(),
  listSavedItems: vi.fn(),
  profileCounts: vi.fn(),
  replaceCompanyDatasetWithEmbeddings: vi.fn(),
  searchCompanyVectors: vi.fn(),
  toggleSavedProfile: vi.fn(),
}));
const companyMatchMocks = vi.hoisted(() => ({ analyzeCompanyCandidate: vi.fn(), refineCompanyStatement: vi.fn() }));
const companyDirectoryMocks = vi.hoisted(() => ({ companyEmbeddingSignature: vi.fn(), embedCompanyProfiles: vi.fn(), embedText: vi.fn(), fetchOfficialCompanyDirectory: vi.fn() }));

vi.mock("./db", () => dbMocks);
vi.mock("./companyMatch", () => companyMatchMocks);
vi.mock("./companyDirectory", () => companyDirectoryMocks);
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

import { appRouter } from "./routers";

const profile = (id: string) => ({ id, sourceType: "company" as const, recordKey: id, name: id, website: null, sector: "Green Technology", stage: null, technology: "AI energy management", description: "A dataset-backed company profile", investmentFocus: null, ticketSize: null, portfolio: null, normalizedText: "AI energy climate technology", rawData: {}, importBatchId: "test", createdAt: new Date(), updatedAt: new Date() });
function context(): TrpcContext { return { user: { id: 12, openId: "member", email: "member@example.com", name: "Member", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }

describe("Company Match routers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const companies = [profile("company-1"), profile("company-2"), profile("company-3")];
    dbMocks.browseProfiles.mockResolvedValue({ items: companies, total: companies.length });
    dbMocks.getProfile.mockImplementation(async (id: string) => companies.find(company => company.id === id));
    dbMocks.getProfilesByIds.mockResolvedValue(companies);
    dbMocks.searchCompanyVectors.mockResolvedValue([{ profileId: "company-1", similarity: 0.91 }, { profileId: "company-2", similarity: 0.83 }, { profileId: "company-3", similarity: 0.8 }]);
    dbMocks.toggleSavedProfile.mockResolvedValue({ saved: true });
    companyDirectoryMocks.embedText.mockResolvedValue("[0.1,0.2]");
    companyMatchMocks.refineCompanyStatement.mockResolvedValue({ refinedStatement: "Find Hong Kong AI energy-management companies.", searchFocus: ["AI", "energy"], exclusions: [], clarification: null });
    companyMatchMocks.analyzeCompanyCandidate.mockImplementation(async (_statement: string, candidate: { id: string }) => candidate.id === "company-2" ? { isSuitable: false, score: 80, rationale: "Off target", strengths: [], gaps: ["Not relevant"], verificationNeeded: false, verificationQuery: null } : { isSuitable: true, score: candidate.id === "company-1" ? 92 : 78, rationale: "Relevant company", strengths: ["AI energy"], gaps: [], verificationNeeded: false, verificationQuery: null });
  });

  it("forwards company-directory filters without exposing a source-type selector", async () => {
    const result = await appRouter.createCaller(context()).profiles.browse({ query: "energy", sector: "Green" });
    expect(dbMocks.browseProfiles).toHaveBeenCalledWith(expect.objectContaining({ sourceType: "company", query: "energy", sector: "Green" }));
    expect(result.total).toBe(3);
  });

  it("persists authenticated saves only after confirming the profile is a company", async () => {
    const result = await appRouter.createCaller(context()).profiles.toggleSaved({ profileId: "company-1" });
    expect(dbMocks.toggleSavedProfile).toHaveBeenCalledWith(12, "company-1", expect.any(String));
    expect(result).toEqual({ saved: true });
  });

  it("returns an editable refined statement", async () => {
    const result = await appRouter.createCaller(context()).companyMatch.refine({ statement: "Find AI energy companies in Hong Kong" });
    expect(companyMatchMocks.refineCompanyStatement).toHaveBeenCalledWith("Find AI energy companies in Hong Kong");
    expect(result.refinedStatement).toContain("AI energy-management");
  });

  it("honors configurable Top-K and removes candidates rejected by the analysis layer", async () => {
    const result = await appRouter.createCaller(context()).companyMatch.match({ refinedStatement: "Find AI energy companies in Hong Kong", topK: 2 });
    expect(companyDirectoryMocks.embedText).toHaveBeenCalled();
    expect(dbMocks.searchCompanyVectors).toHaveBeenCalledWith("[0.1,0.2]", 16);
    expect(result.requestedTopK).toBe(2);
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map(item => item.profile.id)).toEqual(["company-1", "company-3"]);
    expect(result.excludedCount).toBe(1);
  });
});
