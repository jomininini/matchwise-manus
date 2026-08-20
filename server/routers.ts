import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { datasetImports, type ProfileSourceType } from "../drizzle/schema";
import {
  browseProfiles,
  getDb,
  getProfile,
  getProfilesByIds,
  isProfileSaved,
  listDatasetImports,
  listProfilesByTypes,
  listSavedItems,
  profileCounts,
  replaceDataset,
  saveMatch,
  toggleSavedProfile,
} from "./db";
import { analyzeMatch, oppositeTypes, rankProfiles } from "./matching";
import { ENV } from "./_core/env";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { normalizeCsvDataset, type SourceType } from "./profileImport";
import { storagePut } from "./storage";

const sourceTypeSchema = z.enum(["company", "solution", "investor"]);

const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.openId !== ENV.ownerOpenId && ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "This workspace area is restricted to the project owner." });
  }
  return next();
});

function decodeCsv(base64Csv: string) {
  const csv = Buffer.from(base64Csv, "base64").toString("utf8");
  if (!csv.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded dataset was empty." });
  return csv;
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
    counts: publicProcedure.query(() => profileCounts()),
    browse: publicProcedure
      .input(z.object({ sourceType: sourceTypeSchema, query: z.string().max(180).optional(), sector: z.string().max(180).optional(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(60).optional() }))
      .query(({ input }) => browseProfiles(input)),
    byId: publicProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).query(({ input }) => getProfile(input.profileId)),
    byIds: publicProcedure.input(z.object({ profileIds: z.array(z.string().min(1).max(96)).max(60) })).query(({ input }) => getProfilesByIds(input.profileIds)),
    savedStatus: protectedProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).query(({ ctx, input }) => isProfileSaved(ctx.user.id, input.profileId)),
    toggleSaved: protectedProcedure.input(z.object({ profileId: z.string().min(1).max(96) })).mutation(({ ctx, input }) => toggleSavedProfile(ctx.user.id, input.profileId, nanoid(18))),
  }),
  saved: router({
    list: protectedProcedure.query(({ ctx }) => listSavedItems(ctx.user.id)),
    saveMatch: protectedProcedure
      .input(z.object({ sourceProfileId: z.string().min(1).max(96), targetProfileId: z.string().min(1).max(96), matchScore: z.number().int().min(0).max(100), matchSummary: z.string().min(1).max(20_000) }))
      .mutation(({ ctx, input }) => saveMatch({ id: nanoid(18), userId: ctx.user.id, ...input })),
  }),
  matching: router({
    ranked: publicProcedure
      .input(z.object({ sourceProfileId: z.string().min(1).max(96) }))
      .mutation(async ({ input }) => {
        const source = await getProfile(input.sourceProfileId);
        if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "The source profile is no longer available." });
        const candidateTypes: ProfileSourceType[] = [...oppositeTypes(source.sourceType)];
        const candidates = await listProfilesByTypes(candidateTypes);
        const results = await rankProfiles(source.normalizedText, candidates, `Find the strongest ${source.sourceType === "investor" ? "HKSTP startup" : "investor"} matches for this profile.`);
        const rankedProfiles = await getProfilesByIds(results.map(result => result.profileId));
        return results.map(result => ({ ...result, profile: rankedProfiles.find(profile => profile.id === result.profileId) })).filter(result => result.profile);
      }),
    detail: publicProcedure
      .input(z.object({ sourceProfileId: z.string().min(1).max(96), targetProfileId: z.string().min(1).max(96) }))
      .mutation(async ({ input }) => {
        const [source, target] = await Promise.all([getProfile(input.sourceProfileId), getProfile(input.targetProfileId)]);
        if (!source || !target) throw new TRPCError({ code: "NOT_FOUND", message: "One or both profiles are unavailable." });
        const expectedTypes: ProfileSourceType[] = [...oppositeTypes(source.sourceType)];
        if (!expectedTypes.includes(target.sourceType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Select a startup and investor profile for a comparison." });
        const analysis = await analyzeMatch(source, target);
        return { source, target, analysis };
      }),
    smartSearch: publicProcedure
      .input(z.object({ query: z.string().min(4).max(1400), target: z.enum(["startup", "investor", "solution"]) }))
      .mutation(async ({ input }) => {
        const sourceTypes: ProfileSourceType[] = input.target === "startup" ? ["company"] : input.target === "solution" ? ["solution"] : ["investor"];
        const candidates = await listProfilesByTypes(sourceTypes);
        const results = await rankProfiles(input.query, candidates, `Find the best ${input.target} profiles for this natural-language request.`);
        const rankedProfiles = await getProfilesByIds(results.map(result => result.profileId));
        return results.map(result => ({ ...result, profile: rankedProfiles.find(profile => profile.id === result.profileId) })).filter(result => result.profile);
      }),
  }),
  admin: router({
    imports: ownerProcedure.query(() => listDatasetImports()),
    importCsv: ownerProcedure
      .input(z.object({ sourceType: sourceTypeSchema, fileName: z.string().min(1).max(512), base64Csv: z.string().min(1).max(60_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const csv = decodeCsv(input.base64Csv);
        const batchId = nanoid(18);
        const { key } = await storagePut(`datasets/${batchId}-${input.fileName}`, Buffer.from(csv, "utf8"), "text/csv");
        const normalized = normalizeCsvDataset(input.sourceType as SourceType, csv, batchId);
        await replaceDataset(input.sourceType as SourceType, { id: batchId, fileName: input.fileName, fileKey: key, importedBy: ctx.user.id }, normalized);
        return { batchId, recordCount: normalized.length };
      }),
    removeImport: ownerProcedure
      .input(z.object({ importId: z.string().min(1).max(96) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database is unavailable." });
        await db.delete(datasetImports).where(eq(datasetImports.id, input.importId));
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
