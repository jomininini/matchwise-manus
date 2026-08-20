import {
  boolean,
  customType,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const vector1024 = customType<{ data: string; driverData: string }>({
  dataType() {
    return "VECTOR(1024)";
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value;
  },
});

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const profiles = mysqlTable(
  "profiles",
  {
    id: varchar("id", { length: 96 }).primaryKey(),
    sourceType: mysqlEnum("sourceType", ["company", "solution", "investor"]).notNull(),
    recordKey: varchar("recordKey", { length: 160 }).notNull(),
    name: text("name").notNull(),
    website: varchar("website", { length: 2048 }),
    sector: varchar("sector", { length: 255 }),
    stage: varchar("stage", { length: 255 }),
    technology: mediumtext("technology"),
    description: mediumtext("description"),
    investmentFocus: mediumtext("investmentFocus"),
    ticketSize: varchar("ticketSize", { length: 255 }),
    portfolio: mediumtext("portfolio"),
    normalizedText: mediumtext("normalizedText").notNull(),
    rawData: json("rawData").notNull(),
    importBatchId: varchar("importBatchId", { length: 96 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("profiles_source_record_unique").on(table.sourceType, table.recordKey),
    index("profiles_source_idx").on(table.sourceType),
    index("profiles_import_batch_idx").on(table.importBatchId),
  ],
);

export const datasetImports = mysqlTable("datasetImports", {
  id: varchar("id", { length: 96 }).primaryKey(),
  sourceType: mysqlEnum("sourceType", ["company", "solution", "investor"]).notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileKey: varchar("fileKey", { length: 1024 }),
  recordCount: int("recordCount").default(0).notNull(),
  status: mysqlEnum("status", ["processing", "ready", "failed"]).default("processing").notNull(),
  errorMessage: text("errorMessage"),
  importedBy: int("importedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export const companyEmbeddings = mysqlTable(
  "companyEmbeddings",
  {
    id: varchar("id", { length: 96 }).primaryKey(),
    profileId: varchar("profileId", { length: 96 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    inputHash: varchar("inputHash", { length: 64 }).notNull(),
    embedding: vector1024("embedding").notNull(),
    importBatchId: varchar("importBatchId", { length: 96 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("company_embeddings_profile_unique").on(table.profileId),
    index("company_embeddings_import_idx").on(table.importBatchId),
  ],
);

export const companyDataActivities = mysqlTable(
  "companyDataActivities",
  {
    id: varchar("id", { length: 96 }).primaryKey(),
    profileId: varchar("profileId", { length: 96 }),
    activityType: mysqlEnum("activityType", ["edit", "enrichment", "vector_update", "official_refresh"]).notNull(),
    status: mysqlEnum("status", ["draft", "applied", "completed", "failed"]).default("draft").notNull(),
    sourceLabel: varchar("sourceLabel", { length: 255 }).notNull(),
    inputData: json("inputData"),
    outputData: json("outputData"),
    createdBy: int("createdBy").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [
    index("company_data_activity_profile_idx").on(table.profileId),
    index("company_data_activity_type_idx").on(table.activityType),
    index("company_data_activity_created_idx").on(table.createdAt),
  ],
);

export const savedItems = mysqlTable(
  "savedItems",
  {
    id: varchar("id", { length: 96 }).primaryKey(),
    userId: int("userId").notNull(),
    itemType: mysqlEnum("itemType", ["profile", "match"]).notNull(),
    profileId: varchar("profileId", { length: 96 }),
    sourceProfileId: varchar("sourceProfileId", { length: 96 }),
    targetProfileId: varchar("targetProfileId", { length: 96 }),
    matchScore: int("matchScore"),
    matchSummary: mediumtext("matchSummary"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    primaryKey({ columns: [table.id] }),
    index("saved_items_user_idx").on(table.userId),
    uniqueIndex("saved_profile_per_user_unique").on(table.userId, table.profileId),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type ProfileSourceType = Profile["sourceType"];
export type SavedItem = typeof savedItems.$inferSelect;
export type CompanyEmbedding = typeof companyEmbeddings.$inferSelect;
export type CompanyDataActivity = typeof companyDataActivities.$inferSelect;
