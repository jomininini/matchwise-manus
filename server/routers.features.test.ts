import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  browseProfiles: vi.fn(),
  createCompanyDataActivity: vi.fn(),
  getCompanyDatasetPreview: vi.fn(),
  getCompanyEmbeddingHashes: vi.fn(),
  getCompanyManagementSummary: vi.fn(),
  getProfile: vi.fn(),
  getProfilesByIds: vi.fn(),
  isProfileSaved: vi.fn(),
  listDatasetImports: vi.fn(),
  listSavedItems: vi.fn(),
  profileCounts: vi.fn(),
  replaceCompanyDatasetWithEmbeddings: vi.fn(),
  searchCompanyVectors: vi.fn(),
  toggleSavedProfile: vi.fn(),
  updateCompanyProfile: vi.fn(),
  upsertCompanyEmbeddings: vi.fn(),
}));
const companyMatchMocks = vi.hoisted(() => ({ analyzeCompanyCandidate: vi.fn(), refineCompanyStatement: vi.fn() }));
const companyEnrichmentMocks = vi.hoisted(() => ({ enrichCompanyProfile: vi.fn(), enrichmentToProfilePatch: vi.fn() }));
const storageMocks = vi.hoisted(() => ({ storageGet: vi.fn(), storagePut: vi.fn() }));
const companyDirectoryMocks = vi.hoisted(() => ({ companyEmbeddingSignature: vi.fn(), embedCompanyProfiles: vi.fn(), embedText: vi.fn(), fetchOfficialCompanyDirectory: vi.fn() }));

vi.mock("./db", () => dbMocks);
vi.mock("./companyMatch", () => companyMatchMocks);
vi.mock("./companyEnrichment", () => companyEnrichmentMocks);
vi.mock("./companyDirectory", () => companyDirectoryMocks);
vi.mock("./storage", () => storageMocks);

import { appRouter } from "./routers";

const profile = (id: string) => ({ id, sourceType: "company" as const, recordKey: id, name: id, website: null, sector: "Green Technology", stage: null, technology: "AI energy management", description: "A dataset-backed company profile", investmentFocus: null, ticketSize: null, portfolio: null, normalizedText: "AI energy climate technology", rawData: {}, importBatchId: "test", createdAt: new Date(), updatedAt: new Date() });
function context(): TrpcContext { return { user: { id: 12, openId: "member", email: "member@example.com", name: "Member", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: () => undefined } as TrpcContext["res"] }; }
function ownerContext(): TrpcContext { return { ...context(), user: { ...context().user!, id: 1, openId: "owner", role: "admin" } }; }

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
    companyMatchMocks.refineCompanyStatement.mockResolvedValue({ refinedStatement: "Find Hong Kong AI energy-management companies.", searchFocus: ["AI", "energy"], capabilities: ["AI energy optimization"], useCases: ["commercial buildings"], industryContext: ["Green Technology"], geography: ["Hong Kong"], evidenceRequirements: ["measurable reduction"], retrievalTerms: ["AI", "energy", "building"], exclusions: [], clarification: null });
    companyMatchMocks.analyzeCompanyCandidate.mockImplementation(async (_statement: string, candidate: { id: string }) => candidate.id === "company-2" ? { isSuitable: false, score: 80, rationale: "Off target", strengths: [], gaps: ["Not relevant"], verificationNeeded: false, verificationQuery: null } : { isSuitable: true, score: candidate.id === "company-1" ? 92 : 78, rationale: "Relevant company", strengths: ["AI energy"], gaps: [], verificationNeeded: false, verificationQuery: null });
    dbMocks.getCompanyManagementSummary.mockResolvedValue({ companyCount: 3, vectorCount: 3, latestImport: undefined, latestActivity: undefined });
    dbMocks.listDatasetImports.mockResolvedValue([{ id: "import-1", sourceType: "company", fileName: "hkstp-company-directory.csv", fileKey: "datasets/company.csv", recordCount: 3, status: "ready", errorMessage: null, importedBy: 1, createdAt: new Date(), completedAt: new Date() }]);
    dbMocks.createCompanyDataActivity.mockResolvedValue("activity-1");
    dbMocks.updateCompanyProfile.mockResolvedValue(companies[0]);
    dbMocks.upsertCompanyEmbeddings.mockResolvedValue(undefined);
    companyDirectoryMocks.companyEmbeddingSignature.mockReturnValue({ text: "Company test", inputHash: "hash" });
    companyDirectoryMocks.embedCompanyProfiles.mockResolvedValue([{ id: "embedding-1", profileId: "company-1", model: "baai/bge-m3", inputHash: "hash", embedding: "[0.1,0.2]", importBatchId: "manual" }]);
    storageMocks.storageGet.mockResolvedValue({ key: "datasets/company.csv", url: "/manus-storage/datasets/company.csv" });
    companyEnrichmentMocks.enrichCompanyProfile.mockResolvedValue({ enrichedSummary: "Official-data enrichment", products: ["Energy platform"], technologies: ["AI"], services: ["Implementation"], targetApplications: ["Commercial buildings"], confidenceNote: "Review before applying", verificationQueries: ["company website products"], sourceNotes: ["Official HKSTP directory"] });
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

  it("accepts long source requirements without a router-level character cap", async () => {
    const longStatement = `Company need: ${"detailed context ".repeat(900)}`;
    await appRouter.createCaller(context()).companyMatch.refine({ statement: longStatement });
    expect(companyMatchMocks.refineCompanyStatement).toHaveBeenCalledWith(longStatement);
  });

  it("recalls the requested number of semantic candidates before analysis", async () => {
    const result = await appRouter.createCaller(context()).companyMatch.recall({ refinedStatement: "Find AI energy companies in Hong Kong", topK: 3 });
    expect(companyDirectoryMocks.embedText).toHaveBeenCalledWith("Find AI energy companies in Hong Kong");
    expect(dbMocks.searchCompanyVectors).toHaveBeenCalledWith("[0.1,0.2]", 3);
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.profile.id).toBe("company-1");
  });

  it("runs a visible analysis only for the candidate chosen by the staged workflow", async () => {
    const result = await appRouter.createCaller(context()).companyMatch.analyzeCandidate({ refinedStatement: "Find AI energy companies in Hong Kong", profileId: "company-2", semanticSimilarity: 0.83 });
    expect(companyMatchMocks.analyzeCompanyCandidate).toHaveBeenCalledWith("Find AI energy companies in Hong Kong", expect.objectContaining({ id: "company-2" }), 0.83);
    expect(result.analysis.isSuitable).toBe(false);
  });

  it("allows the owner to inspect data governance summary and create a reviewable enrichment draft", async () => {
    const caller = appRouter.createCaller(ownerContext());
    const summary = await caller.admin.summary();
    expect(summary).toEqual(expect.objectContaining({ companyCount: 3, vectorCount: 3 }));
    const result = await caller.admin.enrichCompany({ profileId: "company-1" });
    expect(companyEnrichmentMocks.enrichCompanyProfile).toHaveBeenCalledWith(expect.objectContaining({ id: "company-1" }));
    expect(dbMocks.createCompanyDataActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: "enrichment", status: "draft", createdBy: 1 }));
    expect(result.draft.technologies).toContain("AI");
  });

  it("limits owner batch enrichment to selected company records and stores reviewable drafts", async () => {
    const caller = appRouter.createCaller(ownerContext());
    const result = await caller.admin.enrichCompanies({ profileIds: ["company-1", "company-2"] });
    expect(result.processedCount).toBe(2);
    expect(companyEnrichmentMocks.enrichCompanyProfile).toHaveBeenCalledTimes(2);
    expect(dbMocks.createCompanyDataActivity).toHaveBeenCalledTimes(2);
    expect(result.results.map(item => item.profileId)).toEqual(["company-1", "company-2"]);
  });

  it("lets the owner edit a company and request a targeted vector refresh", async () => {
    const caller = appRouter.createCaller(ownerContext());
    await caller.admin.editCompany({ profileId: "company-1", description: "Updated company description" });
    expect(dbMocks.updateCompanyProfile).toHaveBeenCalledWith(expect.objectContaining({ profileId: "company-1", description: "Updated company description" }));
    const vectorResult = await caller.admin.revectorCompanies({ profileIds: ["company-1"] });
    expect(companyDirectoryMocks.embedCompanyProfiles).toHaveBeenCalled();
    expect(dbMocks.upsertCompanyEmbeddings).toHaveBeenCalled();
    expect(vectorResult.updatedCount).toBe(1);
  });

  it("provides the latest official CSV link to the owner", async () => {
    const result = await appRouter.createCaller(ownerContext()).admin.latestCsv();
    expect(storageMocks.storageGet).toHaveBeenCalledWith("datasets/company.csv");
    expect(result).toEqual({ importId: "import-1", fileName: "hkstp-company-directory.csv", url: "/manus-storage/datasets/company.csv" });
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
