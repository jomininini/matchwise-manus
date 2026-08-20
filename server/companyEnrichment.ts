import type { Profile } from "../drizzle/schema";

const MODEL = "openai/gpt-4o-mini";

export type CompanyEnrichmentDraft = {
  enrichedSummary: string;
  products: string[];
  technologies: string[];
  services: string[];
  targetApplications: string[];
  confidenceNote: string;
  verificationQueries: string[];
  sourceNotes: string[];
};

function plainText(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 24_000);
}

async function publicWebsiteContext(website: string | null) {
  if (!website) return { text: null, sourceNote: "No public company website was supplied in the official directory." };
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    const blocked = ["localhost", "127.0.0.1", "::1"].includes(url.hostname) || url.hostname.endsWith(".local") || url.hostname.endsWith(".internal");
    if (!/^https?:$/.test(url.protocol) || blocked) return { text: null, sourceNote: `Website was not fetched because its URL is not an allowed public HTTP(S) address: ${website}` };
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "MatchwiseCompanyResearch/1.0" } });
    if (!response.ok) return { text: null, sourceNote: `Public website request returned ${response.status}: ${url.hostname}` };
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) return { text: null, sourceNote: `Public website was skipped because it did not return readable HTML/text: ${url.hostname}` };
    const text = plainText(await response.text());
    return { text: text || null, sourceNote: text ? `Public company website content reviewed: ${url.origin}` : `Public website returned no readable text: ${url.origin}` };
  } catch (error) {
    return { text: null, sourceNote: `Public website could not be fetched: ${error instanceof Error ? error.message.slice(0, 140) : "unknown error"}` };
  }
}

async function structuredEnrichment(profile: Profile): Promise<CompanyEnrichmentDraft> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required for enrichment");
  const website = await publicWebsiteContext(profile.website);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-Title": "Matchwise Data Enrichment" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        { role: "system", content: "You are a data curator for an HKSTP company directory. Build a concise enrichment draft strictly from supplied official company data and, when present, extracted public company website text. Do not invent customers, traction, certifications, funding or capabilities. Treat missing or ambiguous facts as verification queries. Keep output in the record's primary language; retain English product or technical terms where they are official. Clearly list the exact sources that were supplied to you." },
        { role: "user", content: JSON.stringify({ name: profile.name, cluster: profile.sector, website: profile.website, description: profile.description, technology: profile.technology, officialRawData: profile.rawData, publicWebsiteExtract: website.text, websiteCollectionNote: website.sourceNote }) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "company_enrichment_draft", strict: true, schema: {
        type: "object", properties: {
          enrichedSummary: { type: "string", maxLength: 900 },
          products: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 8 },
          technologies: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 8 },
          services: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 8 },
          targetApplications: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 8 },
          confidenceNote: { type: "string", maxLength: 300 },
          verificationQueries: { type: "array", items: { type: "string", maxLength: 220 }, maxItems: 5 },
          sourceNotes: { type: "array", items: { type: "string", maxLength: 280 }, minItems: 1, maxItems: 5 },
        }, required: ["enrichedSummary", "products", "technologies", "services", "targetApplications", "confidenceNote", "verificationQueries", "sourceNotes"], additionalProperties: false,
      } } },
    }),
    signal: AbortSignal.timeout(75_000),
  });
  if (!response.ok) throw new Error(`OpenRouter enrichment failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty enrichment draft");
  const draft = JSON.parse(content) as CompanyEnrichmentDraft;
  return { ...draft, sourceNotes: [...(draft.sourceNotes ?? []), website.sourceNote].filter((value, index, values) => value && values.indexOf(value) === index).slice(0, 5) };
}

export async function enrichCompanyProfile(profile: Profile) {
  if (profile.sourceType !== "company") throw new Error("Only company profiles can be enriched");
  return structuredEnrichment(profile);
}

export function enrichmentToProfilePatch(draft: CompanyEnrichmentDraft) {
  const technology = [...draft.technologies, ...draft.products].filter(Boolean).join(" · ").slice(0, 40_000) || null;
  const description = draft.enrichedSummary.trim().slice(0, 40_000) || null;
  return { technology, description, rawPatch: { enrichment: { source: "OpenRouter structured enrichment", generatedAt: new Date().toISOString(), draft } } };
}
