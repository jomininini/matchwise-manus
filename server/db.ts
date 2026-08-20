import { and, asc, count, desc, eq, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  datasetImports,
  InsertUser,
  profiles,
  ProfileSourceType,
  savedItems,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import type { NormalizedProfileInput, SourceType } from "./profileImport";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type BrowseOptions = {
  sourceType: ProfileSourceType;
  query?: string;
  sector?: string;
  page?: number;
  pageSize?: number;
};

export async function browseProfiles(options: BrowseOptions) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, options.pageSize ?? 18));
  const filters = [eq(profiles.sourceType, options.sourceType)];
  const query = options.query?.trim();
  if (query) {
    const pattern = `%${query}%`;
    filters.push(or(like(profiles.name, pattern), like(profiles.normalizedText, pattern))!);
  }
  if (options.sector?.trim()) filters.push(like(profiles.sector, `%${options.sector.trim()}%`));
  const where = and(...filters);
  const [items, totalRows] = await Promise.all([
    db
      .select()
      .from(profiles)
      .where(where)
      .orderBy(asc(profiles.name))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(profiles).where(where),
  ]);
  return { items, total: totalRows[0]?.total ?? 0 };
}

export async function getProfile(profileId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  return rows[0];
}

export async function getProfilesByIds(profileIds: string[]) {
  const db = await getDb();
  if (!db || profileIds.length === 0) return [];
  return db.select().from(profiles).where(inArray(profiles.id, profileIds));
}

export async function listProfilesByTypes(sourceTypes: ProfileSourceType[]) {
  const db = await getDb();
  if (!db || sourceTypes.length === 0) return [];
  return db.select().from(profiles).where(inArray(profiles.sourceType, sourceTypes));
}

export async function profileCounts() {
  const db = await getDb();
  if (!db) return { company: 0, solution: 0, investor: 0 };
  const rows = await db.select({ sourceType: profiles.sourceType, total: count() }).from(profiles).groupBy(profiles.sourceType);
  return rows.reduce(
    (counts, row) => ({ ...counts, [row.sourceType]: row.total }),
    { company: 0, solution: 0, investor: 0 } as Record<ProfileSourceType, number>,
  );
}

export async function replaceDataset(
  sourceType: SourceType,
  importBatch: { id: string; fileName: string; fileKey?: string | null; importedBy: number },
  incomingProfiles: NormalizedProfileInput[],
) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(datasetImports).values({
    id: importBatch.id,
    sourceType,
    fileName: importBatch.fileName,
    fileKey: importBatch.fileKey ?? null,
    importedBy: importBatch.importedBy,
    status: "processing",
  });
  try {
    await db.delete(profiles).where(eq(profiles.sourceType, sourceType));
    const chunkSize = 250;
    for (let offset = 0; offset < incomingProfiles.length; offset += chunkSize) {
      await db.insert(profiles).values(incomingProfiles.slice(offset, offset + chunkSize));
    }
    await db
      .update(datasetImports)
      .set({ status: "ready", recordCount: incomingProfiles.length, completedAt: new Date() })
      .where(eq(datasetImports.id, importBatch.id));
  } catch (error) {
    await db
      .update(datasetImports)
      .set({ status: "failed", errorMessage: error instanceof Error ? error.message : "Dataset import failed", completedAt: new Date() })
      .where(eq(datasetImports.id, importBatch.id));
    throw error;
  }
}

export async function listDatasetImports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(datasetImports).orderBy(desc(datasetImports.createdAt)).limit(12);
}

export async function isProfileSaved(userId: number, profileId: string) {
  const db = await getDb();
  if (!db) return false;
  const items = await db
    .select({ id: savedItems.id })
    .from(savedItems)
    .where(and(eq(savedItems.userId, userId), eq(savedItems.profileId, profileId)))
    .limit(1);
  return Boolean(items[0]);
}

export async function toggleSavedProfile(userId: number, profileId: string, itemId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const existing = await db
    .select({ id: savedItems.id })
    .from(savedItems)
    .where(and(eq(savedItems.userId, userId), eq(savedItems.profileId, profileId)))
    .limit(1);
  if (existing[0]) {
    await db.delete(savedItems).where(eq(savedItems.id, existing[0].id));
    return { saved: false };
  }
  await db.insert(savedItems).values({ id: itemId, userId, itemType: "profile", profileId });
  return { saved: true };
}

export async function listSavedItems(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedItems).where(eq(savedItems.userId, userId)).orderBy(desc(savedItems.createdAt));
}

export async function saveMatch(input: {
  id: string;
  userId: number;
  sourceProfileId: string;
  targetProfileId: string;
  matchScore: number;
  matchSummary: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(savedItems).values({ ...input, itemType: "match" });
  return { saved: true };
}
