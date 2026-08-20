import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  browseProfiles: vi.fn(),
  getDb: vi.fn(),
  getProfile: vi.fn(),
  getProfilesByIds: vi.fn(),
  isProfileSaved: vi.fn(),
  listDatasetImports: vi.fn(),
  listProfilesByTypes: vi.fn(),
  listSavedItems: vi.fn(),
  profileCounts: vi.fn(),
  replaceDataset: vi.fn(),
  saveMatch: vi.fn(),
  toggleSavedProfile: vi.fn(),
}));

const matchingMocks = vi.hoisted(() => ({
  analyzeMatch: vi.fn(),
  oppositeTypes: vi.fn((sourceType: string) => sourceType === "investor" ? ["company"] : ["investor"]),
  rankProfiles: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./matching", () => matchingMocks);

import { appRouter } from "./routers";

const profile = (id: string, sourceType: "company" | "solution" | "investor") => ({
  id,
  sourceType,
  recordKey: id,
  name: id,
  website: null,
  sector: sourceType === "investor" ? "Climate" : "Green Technology",
  stage: null,
  technology: "AI energy management",
  description: "A dataset-backed profile",
  investmentFocus: sourceType === "investor" ? "Climate and AI" : null,
  ticketSize: null,
  portfolio: null,
  normalizedText: "AI energy climate technology",
  rawData: {},
  importBatchId: "test",
  createdAt: new Date(),
  updatedAt: new Date(),
});

function context(): TrpcContext {
  return {
    user: { id: 12, openId: "member", email: "member@example.com", name: "Member", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("profile browse, saved items, and matching routers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.browseProfiles.mockResolvedValue({ items: [profile("company-1", "company")], total: 1 });
    dbMocks.getProfile.mockImplementation(async (id: string) => id.startsWith("investor") ? profile(id, "investor") : profile(id, "company"));
    dbMocks.listProfilesByTypes.mockResolvedValue([profile("investor-1", "investor")]);
    dbMocks.getProfilesByIds.mockResolvedValue([profile("investor-1", "investor"), profile("company-1", "company")]);
    matchingMocks.rankProfiles.mockResolvedValue([{ profileId: "investor-1", score: 91, explanation: "Direct climate and AI fit." }]);
    matchingMocks.analyzeMatch.mockResolvedValue({ score: 82, summary: "Clear fit", strengths: ["Shared AI focus"], gaps: ["Ticket size absent"], talkingPoints: ["Discuss a pilot"] });
    dbMocks.toggleSavedProfile.mockResolvedValue({ saved: true });
    dbMocks.saveMatch.mockResolvedValue({ saved: true });
  });

  it("forwards text and sector filters to the profile browse implementation", async () => {
    const result = await appRouter.createCaller(context()).profiles.browse({ sourceType: "company", query: "energy", sector: "Green" });
    expect(dbMocks.browseProfiles).toHaveBeenCalledWith(expect.objectContaining({ sourceType: "company", query: "energy", sector: "Green" }));
    expect(result.total).toBe(1);
  });

  it("persists authenticated profile saves against the current user", async () => {
    const result = await appRouter.createCaller(context()).profiles.toggleSaved({ profileId: "company-1" });
    expect(dbMocks.toggleSavedProfile).toHaveBeenCalledWith(12, "company-1", expect.any(String));
    expect(result).toEqual({ saved: true });
  });

  it("returns ranked opposite-side profiles for profile-based matching", async () => {
    const result = await appRouter.createCaller(context()).matching.ranked({ sourceProfileId: "company-1" });
    expect(dbMocks.listProfilesByTypes).toHaveBeenCalledWith(["investor"]);
    expect(matchingMocks.rankProfiles).toHaveBeenCalled();
    expect(result[0]?.profile?.id).toBe("investor-1");
  });

  it("runs natural-language search against the requested profile category", async () => {
    const result = await appRouter.createCaller(context()).matching.smartSearch({ query: "AI energy startups", target: "startup" });
    expect(dbMocks.listProfilesByTypes).toHaveBeenCalledWith(["company"]);
    expect(matchingMocks.rankProfiles).toHaveBeenCalledWith("AI energy startups", expect.any(Array), expect.stringContaining("startup"));
    expect(result).toHaveLength(1);
  });

  it("generates an AI detail brief and saves an authenticated match", async () => {
    const caller = appRouter.createCaller(context());
    const detail = await caller.matching.detail({ sourceProfileId: "company-1", targetProfileId: "investor-1" });
    expect(detail.analysis.score).toBe(82);
    await caller.saved.saveMatch({ sourceProfileId: "company-1", targetProfileId: "investor-1", matchScore: 82, matchSummary: "Clear fit" });
    expect(dbMocks.saveMatch).toHaveBeenCalledWith(expect.objectContaining({ userId: 12, sourceProfileId: "company-1", targetProfileId: "investor-1" }));
  });
});
