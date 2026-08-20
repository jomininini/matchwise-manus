import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  browseProfiles,
  getCompanyEmbeddingHashes,
  getProfile,
  getProfilesByIds,
  isProfileSaved,
  listDatasetImports,
  listSavedItems,
  profileCounts,
  replaceCompanyDatasetWithEmbeddings,
  searchCompanyVectors,
  toggleSavedProfile,
} from "./db";
import { analyzeCompanyCandidate, refineCompanyStatement } from "./companyMatch";
import { companyEmbeddingSignature, embedCompanyProfiles, embedText, fetchOfficialCompanyDirectory } from "./companyDirectory";
import { normalizeOfficialCompanyRecords, officialRecordsToCsv } from "./profileImport";
import { storagePut } from "./storage";
import { COOKIE_NAME } from "@shared/const";

const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "This workspace area is restricted to the project owner." });
  return next();
});

async function getCompanyOrThrow(profileId: string) {
  const profile = await getProfile(profileId);
  if (!profile || profile.sourceType !== "company") throw new TRPCError({ code: "NOT_FOUND", message: "The requested company profile is unavailable." });
  return profile;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  profiles: router({
    counts: publicProcedure.query(async () => ({ company: (await profileCounts()).company })),
    browse: publicProcedure
      .input(z.object({ query: z.string().max(180).optional(), sector: z.string().max(180).optional(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(60).optional() }))
      .query(({ input }) => browseProfiles({ ...input, sourceType: "company" })),
    byId: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).query(({ input }) => getCompanyOrThrow(input.profileId)),
    byIds: publicProcedure.input(z.object({ profileIds: z.array(z.string().min(1).max(96)).max(60) })).query(async ({ input }) => (await getProfilesByIds(input.profileIds)).filter(profile => profile.sourceType === "company")),
    savedStatus: protectedProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).query(async ({ ctx, input }) => { await getCompanyOrThrow(input.profileId); return isProfileSaved(ctx.user.id, input.profileId); }),
    toggleSaved: protectedProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).mutation(async ({ ctx, input }) => { await getCompanyOrThrow(input.profileId); return toggleSavedProfile(ctx.user.id, input.profileId, nanoid(18)); }),
  }),
  saved: router({
    list: protectedProcedure.query(async ({ ctx }) => (await listSavedItems(ctx.user.id)).filter(item => item.itemType === "profile")),
  }),
  companyMatch: router({
    refine: publicProcedure.input(z.object({ statement: z.string().min(8).max(4000) })).mutation(({ input }) => refineCompanyStatement(input.statement)),
    match: publicProcedure
      .input(z.object({ refinedStatement: z.string().min(8).max(4000), topK: z.number().int().min(1).max(30).default(10) }))
      .mutation(async ({ input }) => {
        const queryEmbedding = await embedText(input.refinedStatement);
        const nearest = await searchCompanyVectors(queryEmbedding, Math.min(60, Math.max(input.topK * 2, 16)));
        const profilesById = new Map((await getProfilesByIds(nearest.map(item => item.profileId))).filter(profile => profile.sourceType === "company").map(profile => [profile.id, profile]));
        const candidates = nearest.map(item => ({ ...item, profile: profilesById.get(item.profileId) })).filter((item): item is typeof item & { profile: NonNullable<typeof item.profile> } => Boolean(item.profile));
        const analyzed: Array<{ profile: NonNullable<(typeof candidates)[number]["profile"]>; semanticSimilarity: number; analysis: Awaited<ReturnType<typeof analyzeCompanyCandidate>> }> = [];
        for (let offset = 0; offset < candidates.length; offset += 3) {
          const group = await Promise.all(candidates.slice(offset, offset + 3).map(async candidate => ({ profile: candidate.profile, semanticSimilarity: candidate.similarity, analysis: await analyzeCompanyCandidate(input.refinedStatement, candidate.profile, candidate.similarity) })));
          analyzed.push(...group);
        }
        const matches = analyzed.filter(item => item.analysis.isSuitable && item.analysis.score >= 55).sort((a, b) => b.analysis.score - a.analysis.score || b.semanticSimilarity - a.semanticSimilarity).slice(0, input.topK);
        return { refinedStatement: input.refinedStatement, requestedTopK: input.topK, vectorCandidates: candidates.length, excludedCount: analyzed.length - matches.length, matches };
      }),
  }),
  admin: router({
    imports: ownerProcedure.query(async () => (await listDatasetImports()).filter(item => item.sourceType === "company")),
    refreshOfficialCompanies: ownerProcedure.mutation(async ({ ctx }) => {
      const batchId = nanoid(18);
      const records = await fetchOfficialCompanyDirectory();
      if (!records.length) throw new TRPCError({ code: "BAD_GATEWAY", message: "The official HKSTP API returned no company records." });
      const csv = officialRecordsToCsv(records);
      const { key } = await storagePut(`datasets/${batchId}-hkstp-company-directory.csv`, Buffer.from(csv, "utf8"), "text/csv");
      const companies = normalizeOfficialCompanyRecords(records, batchId);
      const existingHashes = await getCompanyEmbeddingHashes();
      const changedCompanies = companies.filter(company => existingHashes.get(company.id) !== companyEmbeddingSignature(company).inputHash);
      const embeddings = await embedCompanyProfiles(changedCompanies, batchId);
      await replaceCompanyDatasetWithEmbeddings({ id: batchId, fileName: "hkstp-company-directory.csv", fileKey: key, importedBy: ctx.user.id }, companies, embeddings);
      return { batchId, recordCount: companies.length, reembeddedCount: embeddings.length, embeddingModel: embeddings[0]?.model ?? "baai/bge-m3" };
    }),
  }),
});

export type AppRouter = typeof appRouter;
