import { nanoid } from "nanoid";
import { companyEmbeddingSignature, fetchOfficialCompanyDirectory, embedCompanyProfiles } from "../server/companyDirectory.ts";
import { normalizeOfficialCompanyRecords, officialRecordsToCsv } from "../server/profileImport.ts";
import { getCompanyEmbeddingHashes, getDb, replaceCompanyDatasetWithEmbeddings } from "../server/db.ts";
import { users } from "../drizzle/schema.ts";
import { storagePut } from "../server/storage.ts";

const db = await getDb();
if (!db) throw new Error("Database is unavailable");
const admins = await db.select().from(users).limit(1);
const admin = admins[0];
if (!admin) throw new Error("An owner account must sign in once before initial company import");

const batchId = nanoid(18);
const records = await fetchOfficialCompanyDirectory();
const csv = officialRecordsToCsv(records);
const { key } = await storagePut(`datasets/${batchId}-hkstp-company-directory.csv`, Buffer.from(csv, "utf8"), "text/csv");
const companies = normalizeOfficialCompanyRecords(records, batchId);
const existingHashes = await getCompanyEmbeddingHashes();
const changedCompanies = companies.filter(company => existingHashes.get(company.id) !== companyEmbeddingSignature(company).inputHash);
const embeddings = await embedCompanyProfiles(changedCompanies, batchId);
await replaceCompanyDatasetWithEmbeddings({ id: batchId, fileName: "hkstp-company-directory.csv", fileKey: key, importedBy: admin.id }, companies, embeddings);
console.log(JSON.stringify({ batchId, records: companies.length, reembedded: embeddings.length, embeddingModel: embeddings[0]?.model ?? "baai/bge-m3", fileKey: key }));
