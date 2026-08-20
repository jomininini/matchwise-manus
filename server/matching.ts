import type { Profile, ProfileSourceType } from "../drizzle/schema";
import { invokeLLM, listLLMModels } from "./_core/llm";

type CandidateScore = { profile: Profile; lexicalScore: number };
type RankedResult = { profileId: string; score: number; explanation: string };

const stopWords = new Set([
  "about", "after", "again", "against", "also", "and", "are", "because", "been", "being", "between", "both", "but", "can", "company", "companies", "could", "each", "for", "from", "have", "into", "investor", "investors", "more", "not", "our", "startup", "startups", "that", "the", "their", "these", "this", "through", "with", "within", "will", "would", "your",
]);

function tokenize(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(token => token.length > 2 && !stopWords.has(token)),
    ),
  );
}

function lexicalScore(query: string, candidate: Profile) {
  const queryTokens = tokenize(query);
  const candidateText = `${candidate.name} ${candidate.sector ?? ""} ${candidate.technology ?? ""} ${candidate.description ?? ""} ${candidate.investmentFocus ?? ""}`;
  const candidateTokens = new Set(tokenize(candidateText));
  const overlap = queryTokens.filter(token => candidateTokens.has(token));
  const sectorBonus = candidate.sector && query.toLowerCase().includes(candidate.sector.toLowerCase()) ? 4 : 0;
  return overlap.length * 8 + sectorBonus + Math.min(8, candidate.name.length > 2 ? 2 : 0);
}

export function chooseCandidatePool(query: string, candidates: Profile[], limit = 12): CandidateScore[] {
  return candidates
    .map(profile => ({ profile, lexicalScore: lexicalScore(query, profile) }))
    .sort((a, b) => b.lexicalScore - a.lexicalScore || a.profile.name.localeCompare(b.profile.name))
    .slice(0, limit);
}

function profileSnapshot(profile: Profile) {
  return {
    id: profile.id,
    type: profile.sourceType,
    name: profile.name,
    sector: profile.sector,
    description: (profile.description ?? "").slice(0, 1400),
    technology: (profile.technology ?? "").slice(0, 700),
    investmentFocus: (profile.investmentFocus ?? "").slice(0, 700),
    ticketSize: profile.ticketSize,
    portfolio: (profile.portfolio ?? "").slice(0, 500),
  };
}

let selectedModel: string | undefined;

async function getMatchingModel() {
  if (selectedModel) return selectedModel;
  const { data } = await listLLMModels();
  selectedModel = data.find(model => model.id === "gpt-5-mini")?.id ?? data.find(model => model.id.startsWith("gpt-5"))?.id ?? data[0]?.id;
  if (!selectedModel) throw new Error("No LLM model is available for matching.");
  return selectedModel;
}

function rankingSchema(candidateIds: string[]) {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "match_ranking",
      strict: true,
      schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              properties: {
                profileId: { type: "string", enum: candidateIds },
                score: { type: "integer", minimum: 0, maximum: 100 },
                explanation: { type: "string", maxLength: 260 },
              },
              required: ["profileId", "score", "explanation"],
              additionalProperties: false,
            },
          },
        },
        required: ["results"],
        additionalProperties: false,
      },
    },
  };
}

export async function rankProfiles(query: string, candidates: Profile[], direction: string) {
  const pool = chooseCandidatePool(query, candidates);
  if (!pool.length) return [] as RankedResult[];
  const candidateIds = pool.map(item => item.profile.id);
  const model = await getMatchingModel();
  const response = await invokeLLM({
    model,
    maxTokens: 3000,
    messages: [
      {
        role: "system",
        content: "You are Matchwise, an objective HKSTP startup-investor matching analyst. Rank only the candidates given. Return exactly six results, ordered from strongest to weakest. Score commercial and strategic fit, grounding every statement in supplied profile data. Never invent facts, users, traction, portfolio companies, or investment mandates. Keep every explanation to one concise sentence of no more than 200 characters.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: direction,
          query,
          candidates: pool.map(item => ({ lexicalSignal: item.lexicalScore, ...profileSnapshot(item.profile) })),
        }),
      },
    ],
    response_format: rankingSchema(candidateIds),
  });
  const responseContent = response.choices[0]?.message?.content;
  let parsed: { results?: RankedResult[] } = {};
  if (typeof responseContent === "string") {
    try {
      parsed = JSON.parse(responseContent) as { results?: RankedResult[] };
    } catch {
      parsed = {};
    }
  }
  const seen = new Set<string>();
  const validated = (parsed.results ?? [])
    .filter(item => candidateIds.includes(item.profileId) && !seen.has(item.profileId))
    .map(item => {
      seen.add(item.profileId);
      return { profileId: item.profileId, score: Math.max(0, Math.min(100, Math.round(item.score))), explanation: item.explanation.trim().slice(0, 1200) };
    })
    .filter(item => item.explanation);
  if (validated.length) return validated.sort((a, b) => b.score - a.score).slice(0, 6);
  return pool.slice(0, 6).map((item, index) => ({
    profileId: item.profile.id,
    score: Math.max(36, Math.min(84, 78 - index * 5 + Math.min(12, item.lexicalScore))),
    explanation: "A preliminary match based on shared language in the supplied profile data. Open the comparison to assess strategic fit in detail.",
  }));
}

const detailSchema = {
  type: "json_schema" as const,
  json_schema: {
    name: "match_detail",
    strict: true,
    schema: {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 0, maximum: 100 },
        summary: { type: "string" },
        strengths: { type: "array", items: { type: "string" } },
        gaps: { type: "array", items: { type: "string" } },
        talkingPoints: { type: "array", items: { type: "string" } },
      },
      required: ["score", "summary", "strengths", "gaps", "talkingPoints"],
      additionalProperties: false,
    },
  },
};

export async function analyzeMatch(source: Profile, target: Profile) {
  const model = await getMatchingModel();
  const response = await invokeLLM({
    model,
    maxTokens: 2200,
    messages: [
      {
        role: "system",
        content: "You are Matchwise, an objective HKSTP startup-investor matching analyst. Compare the two supplied profiles only. Identify evidence-based strengths, gaps or uncertainties, and constructive talking points. Do not invent facts. State uncertainty clearly when a field is absent.",
      },
      { role: "user", content: JSON.stringify({ source: profileSnapshot(source), target: profileSnapshot(target) }) },
    ],
    response_format: detailSchema,
  });
  const responseContent = response.choices[0]?.message?.content;
  const parsed = JSON.parse(typeof responseContent === "string" ? responseContent : "{}") as {
    score: number;
    summary: string;
    strengths: string[];
    gaps: string[];
    talkingPoints: string[];
  };
  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score ?? 0))),
    summary: String(parsed.summary ?? "").slice(0, 1800),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 5).map(item => String(item).slice(0, 600)) : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 5).map(item => String(item).slice(0, 600)) : [],
    talkingPoints: Array.isArray(parsed.talkingPoints) ? parsed.talkingPoints.slice(0, 5).map(item => String(item).slice(0, 600)) : [],
  };
}

export function oppositeTypes(sourceType: ProfileSourceType) {
  return sourceType === "investor" ? (["company"] as const) : (["investor"] as const);
}
