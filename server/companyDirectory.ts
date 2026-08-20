import { createHash, randomUUID } from "node:crypto";
import type { NormalizedProfileInput, OfficialCompanyRecord } from "./profileImport";

export const HKSTP_COMPANY_DIRECTORY_API = "https://opendata.hkstp.org/corporate/companydirectory/v1/";
export const COMPANY_EMBEDDING_MODEL = "baai/bge-m3";
export const COMPANY_EMBEDDING_DIMENSIONS = 1024;

export type CompanyEmbeddingInput = {
  id: string;
  profileId: string;
  model: string;
  inputHash: string;
  embedding: string;
  importBatchId: string;
};

export async function fetchOfficialCompanyDirectory(fetcher: typeof fetch = fetch): Promise<OfficialCompanyRecord[]> {
  const response = await fetcher(HKSTP_COMPANY_DIRECTORY_API, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HKSTP official directory request failed (${response.status})`);
  const payload = await response.json() as { value?: unknown };
  if (!Array.isArray(payload.value)) throw new Error("HKSTP official directory response does not contain a value array");
  return payload.value.filter(record => record && typeof record === "object") as OfficialCompanyRecord[];
}

export function companyEmbeddingSignature(profile: NormalizedProfileInput) {
  const text = [
    `Company: ${profile.name}`,
    profile.sector ? `HKSTP cluster: ${profile.sector}` : "",
    profile.description ? `Description: ${profile.description}` : "",
    profile.technology ? `Products and technology: ${profile.technology}` : "",
    profile.website ? `Website: ${profile.website}` : "",
  ].filter(Boolean).join("\n").slice(0, 24_000);
  return { text, inputHash: createHash("sha256").update(text).digest("hex") };
}

function companyEmbeddingText(profile: NormalizedProfileInput) {
  return companyEmbeddingSignature(profile).text;
}

async function requestEmbeddings(inputs: string[], fetcher: typeof fetch = fetch): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for company embeddings");
  let lastError = "OpenRouter embedding request failed";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetcher("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Matchwise Company Match" },
      body: JSON.stringify({ model: COMPANY_EMBEDDING_MODEL, input: inputs, encoding_format: "float", provider: { allow_fallbacks: true } }),
      signal: AbortSignal.timeout(90_000),
    });
    if (response.ok) {
      const payload = await response.json() as { data?: Array<{ index?: number; embedding?: number[] }> };
      const vectors = (payload.data ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(item => item.embedding ?? []);
      if (vectors.length !== inputs.length || vectors.some(vector => vector.length !== COMPANY_EMBEDDING_DIMENSIONS)) throw new Error("OpenRouter returned an incomplete or unexpected embedding dimension");
      return vectors;
    }
    lastError = `OpenRouter embedding request failed (${response.status}): ${(await response.text()).slice(0, 500)}`;
    if (response.status !== 429 && response.status !== 529) break;
    await new Promise(resolve => setTimeout(resolve, 1_000 * 2 ** attempt));
  }
  throw new Error(lastError);
}

export async function embedText(text: string, fetcher: typeof fetch = fetch) {
  const [embedding] = await requestEmbeddings([text.slice(0, 24_000)], fetcher);
  if (!embedding) throw new Error("OpenRouter did not return a query embedding");
  return JSON.stringify(embedding);
}

export async function embedCompanyProfiles(profiles: NormalizedProfileInput[], importBatchId: string, fetcher: typeof fetch = fetch): Promise<CompanyEmbeddingInput[]> {
  const inputs = profiles.map(companyEmbeddingText);
  const embeddings: CompanyEmbeddingInput[] = [];
  const batchSize = 32;
  for (let offset = 0; offset < inputs.length; offset += batchSize) {
    const batch = inputs.slice(offset, offset + batchSize);
    const vectors = await requestEmbeddings(batch, fetcher);
    vectors.forEach((vector, index) => {
      const text = batch[index]!;
      const profile = profiles[offset + index]!;
      embeddings.push({ id: `embedding-${randomUUID()}`, profileId: profile.id, model: COMPANY_EMBEDDING_MODEL, inputHash: companyEmbeddingSignature(profile).inputHash, embedding: JSON.stringify(vector), importBatchId });
    });
  }
  return embeddings;
}
