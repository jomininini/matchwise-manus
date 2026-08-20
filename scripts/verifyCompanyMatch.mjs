import { refineCompanyStatement, analyzeCompanyCandidate } from "../server/companyMatch.ts";
import { embedText } from "../server/companyDirectory.ts";
import { getProfilesByIds, searchCompanyVectors } from "../server/db.ts";

const statement = "寻找提供人工智能、物联网和商业楼宇节能解决方案的香港科技公司";
const refined = await refineCompanyStatement(statement);
const embedding = await embedText(refined.refinedStatement);
const nearest = await searchCompanyVectors(embedding, 3);
const profiles = await getProfilesByIds(nearest.map(item => item.profileId));
const first = profiles[0];
if (!first) throw new Error("Vector search returned no company profiles");
const analysis = await analyzeCompanyCandidate(refined.refinedStatement, first, nearest.find(item => item.profileId === first.id)?.similarity ?? 0);
console.log(JSON.stringify({ refinedStatement: refined.refinedStatement, candidates: nearest.length, firstCompany: first.name, analysis: { isSuitable: analysis.isSuitable, score: analysis.score } }));
