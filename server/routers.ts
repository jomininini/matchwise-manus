import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  browseProfiles,
  createCompanyDataActivity,
  getCompanyDatasetPreview,
  getCompanyEmbeddingHashes,
  getCompanyManagementSummary,
  getProfile,
  getProfilesByIds,
  isProfileSaved,
  listCompanyDataActivities,
  listDatasetImports,
  listSavedItems,
  profileCounts,
  replaceCompanyDatasetWithEmbeddings,
  searchCompanyVectors,
  toggleSavedProfile,
  updateCompanyProfile,
  upsertCompanyEmbeddings,
} from "./db";
import { analyzeCompanyCandidate, refineCompanyStatement } from "./companyMatch";
import { companyEmbeddingSignature, embedCompanyProfiles, embedText, fetchOfficialCompanyDirectory } from "./companyDirectory";
import { enrichmentToProfilePatch, enrichCompanyProfile } from "./companyEnrichment";
import { normalizeOfficialCompanyRecords, officialRecordsToCsv, type NormalizedProfileInput } from "./profileImport";
import { storageGet, storagePut } from "./storage";
import { COOKIE_NAME } from "@shared/const";

const SYSTEM_DATA_ACTOR_ID = 1;

async function getCompanyOrThrow(profileId: string) {
  const profile = await getProfile(profileId);
  if (!profile || profile.sourceType !== "company") throw new TRPCError({ code: "NOT_FOUND", message: "The requested company profile is unavailable." });
  return profile;
}

function asCompanyEmbeddingInput(profile: Awaited<ReturnType<typeof getCompanyOrThrow>>): NormalizedProfileInput {
  const rawData = profile.rawData && typeof profile.rawData === "object" && !Array.isArray(profile.rawData) ? profile.rawData as Record<string, string> : {};
  return { id: profile.id, sourceType: "company", recordKey: profile.recordKey, name: profile.name, website: profile.website, sector: profile.sector, stage: profile.stage, technology: profile.technology, description: profile.description, investmentFocus: null, ticketSize: null, portfolio: null, normalizedText: profile.normalizedText, rawData, importBatchId: profile.importBatchId };
}

async function refreshOneCompanyVector(profileId: string, actorId: number, sourceLabel: string) {
  const profile = await getCompanyOrThrow(profileId);
  const batchId = `manual-vector-${nanoid(16)}`;
  const embeddings = await embedCompanyProfiles([asCompanyEmbeddingInput(profile)], batchId);
  await upsertCompanyEmbeddings(embeddings);
  await createCompanyDataActivity({ id: nanoid(18), profileId, activityType: "vector_update", status: "completed", sourceLabel, inputData: { profileId, inputHash: companyEmbeddingSignature(asCompanyEmbeddingInput(profile)).inputHash }, outputData: { model: embeddings[0]?.model, vectorDimensions: 1024 }, createdBy: actorId, completedAt: new Date() });
  return { profileId, model: embeddings[0]?.model ?? "baai/bge-m3", updatedAt: new Date() };
}

const enrichmentDraftSchema = z.object({
  enrichedSummary: z.string(), products: z.array(z.string()), technologies: z.array(z.string()), services: z.array(z.string()), targetApplications: z.array(z.string()), confidenceNote: z.string(), verificationQueries: z.array(z.string()), sourceNotes: z.array(z.string()),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
  }),
  profiles: router({
    counts: publicProcedure.query(async () => ({ company: (await profileCounts()).company })),
    browse: publicProcedure.input(z.object({ query: z.string().max(500).optional(), sector: z.string().max(180).optional(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(60).optional() })).query(({ input }) => browseProfiles({ ...input, sourceType: "company" })),
    byId: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).query(({ input }) => getCompanyOrThrow(input.profileId)),
    byIds: publicProcedure.input(z.object({ profileIds: z.array(z.string().min(1).max(96)).max(60) })).query(async ({ input }) => (await getProfilesByIds(input.profileIds)).filter(profile => profile.sourceType === "company")),
    savedStatus: protectedProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).query(async ({ ctx, input }) => { await getCompanyOrThrow(input.profileId); return isProfileSaved(ctx.user.id, input.profileId); }),
    toggleSaved: protectedProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => { await getCompanyOrThrow(input.profileId); return toggleSavedProfile(ctx.user.id, input.profileId, nanoid(18)); }),
  }),
  saved: router({ list: protectedProcedure.query(async ({ ctx }) => (await listSavedItems(ctx.user.id)).filter(item => item.itemType === "profile")) }),
  companyMatch: router({
    refine: publicProcedure.input(z.object({ statement: z.string().min(1) })).mutation(({ input }) => refineCompanyStatement(input.statement)),
    recall: publicProcedure.input(z.object({ refinedStatement: z.string().min(1), topK: z.number().int().min(1).max(100).default(20) })).mutation(async ({ input }) => {
      const queryEmbedding = await embedText(input.refinedStatement);
      const nearest = await searchCompanyVectors(queryEmbedding, input.topK);
      const profilesById = new Map((await getProfilesByIds(nearest.map(item => item.profileId))).filter(profile => profile.sourceType === "company").map(profile => [profile.id, profile]));
      const candidates = nearest.map(item => ({ ...item, profile: profilesById.get(item.profileId) })).filter((item): item is typeof item & { profile: NonNullable<typeof item.profile> } => Boolean(item.profile));
      return { refinedStatement: input.refinedStatement, requestedTopK: input.topK, candidates };
    }),
    analyzeCandidate: publicProcedure.input(z.object({ refinedStatement: z.string().min(1), profileId: z.string().min(1).max(96), semanticSimilarity: z.number().min(-1).max(1) })).mutation(async ({ input }) => {
      const profile = await getCompanyOrThrow(input.profileId);
      return { profile, semanticSimilarity: input.semanticSimilarity, analysis: await analyzeCompanyCandidate(input.refinedStatement, profile, input.semanticSimilarity) };
    }),
    match: publicProcedure.input(z.object({ refinedStatement: z.string().min(1), topK: z.number().int().min(1).max(30).default(10) })).mutation(async ({ input }) => {
      const recalled = await embedText(input.refinedStatement).then(embedding => searchCompanyVectors(embedding, Math.min(60, Math.max(input.topK * 2, 16))));
      const profilesById = new Map((await getProfilesByIds(recalled.map(item => item.profileId))).filter(profile => profile.sourceType === "company").map(profile => [profile.id, profile]));
      const candidates = recalled.map(item => ({ ...item, profile: profilesById.get(item.profileId) })).filter((item): item is typeof item & { profile: NonNullable<typeof item.profile> } => Boolean(item.profile));
      const analyzed = await Promise.all(candidates.map(async candidate => ({ profile: candidate.profile, semanticSimilarity: candidate.similarity, analysis: await analyzeCompanyCandidate(input.refinedStatement, candidate.profile, candidate.similarity) })));
      const matches = analyzed.filter(item => item.analysis.isSuitable && item.analysis.score >= 55).sort((a, b) => b.analysis.score - a.analysis.score || b.semanticSimilarity - a.semanticSimilarity).slice(0, input.topK);
      return { refinedStatement: input.refinedStatement, requestedTopK: input.topK, vectorCandidates: candidates.length, excludedCount: analyzed.length - matches.length, matches };
    }),
  }),
  admin: router({
    summary: publicProcedure.query(() => getCompanyManagementSummary()),
    imports: publicProcedure.query(async () => (await listDatasetImports()).filter(item => item.sourceType === "company")),
    datasetPreview: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(50).default(20) }).optional()).query(({ input }) => getCompanyDatasetPreview(input?.limit)),
    activities: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96).optional(), limit: z.number().int().min(1).max(100).default(30) }).optional()).query(({ input }) => listCompanyDataActivities(input?.profileId, input?.limit)),
    latestCsv: publicProcedure.query(async () => { const latest = (await listDatasetImports()).find(item => item.sourceType === "company" && item.fileKey); return latest?.fileKey ? { importId: latest.id, fileName: latest.fileName, url: (await storageGet(latest.fileKey)).url } : null; }),
    company: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).query(({ input }) => getCompanyOrThrow(input.profileId)),
    editCompany: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96), name: z.string().min(1).max(2000).optional(), website: z.string().max(2048).nullable().optional(), sector: z.string().max(255).nullable().optional(), technology: z.string().max(50000).nullable().optional(), description: z.string().max(50000).nullable().optional() })).mutation(async ({ input }) => {
      const before = await getCompanyOrThrow(input.profileId);
      const updated = await updateCompanyProfile(input);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      await createCompanyDataActivity({ id: nanoid(18), profileId: input.profileId, activityType: "edit", status: "applied", sourceLabel: "Public workspace manual edit", inputData: { before: { name: before.name, sector: before.sector, technology: before.technology, description: before.description } }, outputData: { after: { name: updated.name, sector: updated.sector, technology: updated.technology, description: updated.description } }, createdBy: SYSTEM_DATA_ACTOR_ID, completedAt: new Date() });
      return updated;
    }),
    enrichCompany: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).mutation(async ({ input }) => {
      const profile = await getCompanyOrThrow(input.profileId);
      const draft = await enrichCompanyProfile(profile);
      const activityId = nanoid(18);
      await createCompanyDataActivity({ id: activityId, profileId: input.profileId, activityType: "enrichment", status: "draft", sourceLabel: "OpenRouter fact-grounded enrichment", inputData: { profileId: input.profileId }, outputData: draft, createdBy: SYSTEM_DATA_ACTOR_ID });
      return { activityId, draft };
    }),
    enrichCompanies: publicProcedure.input(z.object({ profileIds: z.array(z.string().min(1).max(96)).min(1).max(5) })).mutation(async ({ input }) => {
      const results: Array<{ profileId: string; name: string; activityId: string; draft: Awaited<ReturnType<typeof enrichCompanyProfile>> }> = [];
      for (const profileId of Array.from(new Set(input.profileIds))) {
        const profile = await getCompanyOrThrow(profileId);
        const draft = await enrichCompanyProfile(profile);
        const activityId = nanoid(18);
        await createCompanyDataActivity({ id: activityId, profileId, activityType: "enrichment", status: "draft", sourceLabel: "OpenRouter + public website enrichment batch", inputData: { profileId, batch: true }, outputData: draft, createdBy: SYSTEM_DATA_ACTOR_ID });
        results.push({ profileId, name: profile.name, activityId, draft });
      }
      return { processedCount: results.length, results };
    }),
    applyEnrichment: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96), draft: enrichmentDraftSchema, revector: z.boolean().default(true) })).mutation(async ({ input }) => {
      const updated = await updateCompanyProfile({ profileId: input.profileId, ...enrichmentToProfilePatch(input.draft) });
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      await createCompanyDataActivity({ id: nanoid(18), profileId: input.profileId, activityType: "enrichment", status: "applied", sourceLabel: "Public-workspace approved AI enrichment", inputData: input.draft, outputData: { applied: true }, createdBy: SYSTEM_DATA_ACTOR_ID, completedAt: new Date() });
      const vector = input.revector ? await refreshOneCompanyVector(input.profileId, SYSTEM_DATA_ACTOR_ID, "Re-vector after approved enrichment") : null;
      return { profile: updated, vector };
    }),
    revectorCompanies: publicProcedure.input(z.object({ profileIds: z.array(z.string().min(1).max(96)).min(1).max(20) })).mutation(async ({ input }) => {
      const results: Array<{ profileId: string; model: string; updatedAt: Date }> = [];
      for (const profileId of Array.from(new Set(input.profileIds))) results.push(await refreshOneCompanyVector(profileId, SYSTEM_DATA_ACTOR_ID, "Public workspace vector refresh"));
      return { updatedCount: results.length, results };
    }),
    refreshOfficialCompanies: publicProcedure.mutation(async () => {
      const batchId = nanoid(18);
      const records = await fetchOfficialCompanyDirectory();
      if (!records.length) throw new TRPCError({ code: "BAD_GATEWAY", message: "The official HKSTP API returned no company records." });
      const csv = officialRecordsToCsv(records);
      const { key } = await storagePut(`datasets/${batchId}-hkstp-company-directory.csv`, Buffer.from(csv, "utf8"), "text/csv");
      const companies = normalizeOfficialCompanyRecords(records, batchId);
      const existingHashes = await getCompanyEmbeddingHashes();
      const changedCompanies = companies.filter(company => existingHashes.get(company.id) !== companyEmbeddingSignature(company).inputHash);
      const embeddings = await embedCompanyProfiles(changedCompanies, batchId);
      await replaceCompanyDatasetWithEmbeddings({ id: batchId, fileName: "hkstp-company-directory.csv", fileKey: key, importedBy: SYSTEM_DATA_ACTOR_ID }, companies, embeddings);
      await createCompanyDataActivity({ id: nanoid(18), activityType: "official_refresh", status: "completed", sourceLabel: "data.gov.hk / HKSTP official API", inputData: { recordCount: companies.length }, outputData: { reembeddedCount: embeddings.length, model: embeddings[0]?.model ?? "baai/bge-m3" }, createdBy: SYSTEM_DATA_ACTOR_ID, completedAt: new Date() });
      return { batchId, recordCount: companies.length, reembeddedCount: embeddings.length, embeddingModel: embeddings[0]?.model ?? "baai/bge-m3" };
    }),
  }),
});

export type AppRouter = typeof appRouter;
