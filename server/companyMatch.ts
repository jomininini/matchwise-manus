import type { Profile } from "../drizzle/schema";

const OPENROUTER_CHAT_MODEL = "openai/gpt-4o-mini";

type OpenRouterMessage = { role: "system" | "user"; content: string };

async function openRouterJson<T>(messages: OpenRouterMessage[], schemaName: string, schema: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for Company Match");
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Matchwise Company Match" },
    body: JSON.stringify({
      model: OPENROUTER_CHAT_MODEL,
      temperature: 0.15,
      max_tokens: 1100,
      messages,
      response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
    }),
    signal: AbortSignal.timeout(75_000),
  });
  if (!response.ok) throw new Error(`OpenRouter analysis request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty analysis response");
  return JSON.parse(content) as T;
}

export type RefinedStatement = { refinedStatement: string; searchFocus: string[]; exclusions: string[]; clarification: string | null };

export async function refineCompanyStatement(statement: string): Promise<RefinedStatement> {
  const result = await openRouterJson<RefinedStatement>([
    { role: "system", content: "You turn a user's company-discovery request into a concise, faithful semantic-search statement. Preserve the user's intent; do not invent requirements. Return English when the source is English, Chinese when the source is Chinese, and keep any important multilingual terms. Do not give recommendations." },
    { role: "user", content: statement },
  ], "refined_company_statement", {
    type: "object",
    properties: {
      refinedStatement: { type: "string", minLength: 8, maxLength: 1000 },
      searchFocus: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 8 },
      exclusions: { type: "array", items: { type: "string", maxLength: 120 }, maxItems: 8 },
      clarification: { anyOf: [{ type: "string", maxLength: 280 }, { type: "null" }] },
    },
    required: ["refinedStatement", "searchFocus", "exclusions", "clarification"],
    additionalProperties: false,
  });
  return { ...result, refinedStatement: result.refinedStatement.trim().slice(0, 1000) };
}

function companySnapshot(profile: Profile) {
  return { id: profile.id, name: profile.name, cluster: profile.sector, description: (profile.description ?? "").slice(0, 2200), products: (profile.technology ?? "").slice(0, 1200), website: profile.website };
}

export type CompanyCandidateAnalysis = {
  isSuitable: boolean;
  score: number;
  rationale: string;
  strengths: string[];
  gaps: string[];
  verificationNeeded: boolean;
  verificationQuery: string | null;
};

export async function analyzeCompanyCandidate(refinedStatement: string, profile: Profile, semanticSimilarity: number): Promise<CompanyCandidateAnalysis> {
  const result = await openRouterJson<CompanyCandidateAnalysis>([
    { role: "system", content: "You are an objective HKSTP company-fit analyst. Assess one company against the user request strictly from supplied profile data. Reject companies that are materially off-topic. Never invent traction, customers, certifications, funding, or capabilities. Clearly identify unknowns. A verification query is allowed only when the company appears promising but a material factual uncertainty remains; it must be a short public-web search phrase, otherwise null." },
    { role: "user", content: JSON.stringify({ refinedStatement, semanticSimilarity, company: companySnapshot(profile) }) },
  ], "company_candidate_analysis", {
    type: "object",
    properties: {
      isSuitable: { type: "boolean" },
      score: { type: "integer", minimum: 0, maximum: 100 },
      rationale: { type: "string", minLength: 8, maxLength: 650 },
      strengths: { type: "array", items: { type: "string", maxLength: 250 }, maxItems: 4 },
      gaps: { type: "array", items: { type: "string", maxLength: 250 }, maxItems: 4 },
      verificationNeeded: { type: "boolean" },
      verificationQuery: { anyOf: [{ type: "string", maxLength: 220 }, { type: "null" }] },
    },
    required: ["isSuitable", "score", "rationale", "strengths", "gaps", "verificationNeeded", "verificationQuery"],
    additionalProperties: false,
  });
  return { ...result, score: Math.max(0, Math.min(100, Math.round(result.score))), rationale: result.rationale.slice(0, 650), strengths: result.strengths.slice(0, 4), gaps: result.gaps.slice(0, 4) };
}
