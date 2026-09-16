# Matchwise — HKSTP Company Intelligence

**Matchwise** is a bilingual AI company-matching workspace built around the official HKSTP company directory. It converts official company records into normalized profiles and CSV snapshots, stores 1,024-dimensional semantic vectors in TiDB, and separates matching into four reviewable stages: requirement refinement, vector recall, candidate-by-candidate AI analysis, and filtered export.

Matchwise 是一个面向 HKSTP 公司目录的中英文 AI 企业匹配工作区。系统将官方公司资料标准化并生成可追溯 CSV，在 TiDB 中保存 1,024 维语义向量，并通过“需求优化、向量召回、逐条 AI 分析、筛选后导出”四个阶段完成匹配。

**Live application:** [matchwise-kbgzpezq.manus.space](https://matchwise-kbgzpezq.manus.space)

> **Current demo security model:** Company Match and Data Management are intentionally accessible without login. Data edits, enrichment, vector refreshes, and official-data refreshes are written to the governance log under a system actor. Before exposing the system to untrusted users, restore administrator authorization and add rate limiting.

## 1. Main capabilities / 主要功能

| Capability | Description |
|---|---|
| Official data ingestion | Fetches the HKSTP company directory from the official API, normalizes records, and stores a versioned CSV snapshot.[1] |
| Company data governance | Supports record inspection, editing, CSV preview/download, AI enrichment drafts, and auditable activity history. |
| AI enrichment | Supplements product, technology, service, and application information using official records and accessible public company website text. Drafts remain reviewable before application. |
| Semantic vectors | Generates fixed 1,024-dimensional company and query embeddings through OpenRouter using `baai/bge-m3`.[2] |
| Incremental indexing | Uses a SHA-256 input signature to re-embed only new or changed company records. |
| Staged Company Match | Refines an unrestricted requirement, recalls configurable Top-K candidates, analyzes candidates one by one, excludes unsuitable results, and exports retained companies. |
| Bilingual interface | Navigation, data management, matching stages, statuses, and export labels switch together between Chinese and English. |

## 2. System architecture / 系统架构

```mermaid
flowchart LR
  A[HKSTP official API] --> B[Normalize records]
  B --> C[CSV snapshot / object storage]
  B --> D[(TiDB relational profiles)]
  B --> E[OpenRouter embeddings]
  E --> F[(TiDB VECTOR 1024 index)]
  G[User requirement] --> H[LLM requirement refinement]
  H --> I[Query embedding]
  I --> F
  F --> J[Top-K semantic recall]
  J --> K[Candidate-by-candidate LLM analysis]
  K --> L[Retained matches + CSV export]
```

| Layer | Implementation | Responsibility |
|---|---|---|
| Web client | React 19, Vite, Tailwind CSS, shadcn/Radix components | Bilingual Company Match, company directory, saved items, and data-management interfaces. |
| API | Express 4 and tRPC 11 | Typed profile, matching, enrichment, vector, CSV, and governance procedures. |
| Relational data | Drizzle ORM with TiDB/MySQL protocol | Company profiles, import batches, saved items, and governance activities. |
| Vector retrieval | TiDB native `VECTOR(1024)` and cosine distance | Persistent semantic index and Top-K company recall.[3] |
| AI services | OpenRouter embeddings and chat completions | Requirement refinement, embeddings, enrichment, and candidate analysis.[2] |
| File storage | Manus/Forge-managed S3-compatible storage | Versioned official CSV snapshots and secure download redirects. |

## 3. Repository structure / 项目结构

| Path | Purpose |
|---|---|
| `client/src/pages/CompanyMatch.tsx` | Four-stage matching workflow and analyzed-result export. |
| `client/src/pages/Admin.tsx` | Official API, CSV, company editing, enrichment, vector management, and governance log. |
| `client/src/contexts/LocaleContext.tsx` | Shared Chinese/English locale state and governance translations. |
| `server/routers.ts` | Public Company Match and data-management tRPC procedures; authenticated saved-item procedures. |
| `server/companyDirectory.ts` | Official API fetch, embedding input construction, OpenRouter batching, retries, and signatures. |
| `server/companyMatch.ts` | Structured requirement refinement and candidate-by-candidate fit analysis. |
| `server/companyEnrichment.ts` | Reviewable company enrichment based on official and public website content. |
| `server/db.ts` | Profile, CSV import, governance, vector upsert, and similarity-query persistence. |
| `drizzle/schema.ts` | Relational tables and the TiDB `VECTOR(1024)` column. |
| `drizzle/*.sql` | Reviewed schema migrations. |
| `scripts/importOfficialCompanies.mjs` | Optional command-line official-directory import for an initialized environment. |

## 4. Prerequisites / 前置条件

| Requirement | Recommended value |
|---|---|
| Node.js | 22.x |
| pnpm | 10.x |
| Database | TiDB with native vector support; a standard MySQL server without `VECTOR(1024)` support is insufficient. |
| AI provider | OpenRouter API key with access to embeddings and chat-completion models. |
| Storage | Manus Forge storage configuration, or a compatible replacement implementation. |

## 5. Environment variables / 环境变量

Create a local `.env` file for development. Environment files are ignored by Git and must never be committed.

```bash
DATABASE_URL=mysql://USER:PASSWORD@HOST:4000/DATABASE?ssl={"rejectUnauthorized":true}
OPENROUTER_API_KEY=your_openrouter_api_key

# Required for CSV snapshot storage in the current implementation
BUILT_IN_FORGE_API_URL=https://your-forge-api.example.com
BUILT_IN_FORGE_API_KEY=your_server_side_forge_key

# Required only when Manus OAuth / authenticated saved items are enabled
JWT_SECRET=replace_with_a_long_random_secret
VITE_APP_ID=your_manus_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im/app-auth
OWNER_OPEN_ID=your_owner_open_id

# Optional analytics values used by client/index.html
VITE_ANALYTICS_ENDPOINT=
VITE_ANALYTICS_WEBSITE_ID=
```

| Variable | Required | Usage |
|---|---:|---|
| `DATABASE_URL` | Yes | Drizzle connection, migrations, relational data, and vector queries. |
| `OPENROUTER_API_KEY` | Yes | Company/query embeddings, refinement, enrichment, and candidate analysis. |
| `BUILT_IN_FORGE_API_URL` | Yes for CSV storage | Requests signed upload/download URLs. |
| `BUILT_IN_FORGE_API_KEY` | Yes for CSV storage | Server-side authentication to the managed storage service. |
| `JWT_SECRET` and OAuth variables | Conditional | Needed for authenticated saved-item workflows; not required for the current public matching/data-management demo. |
| `PORT` | Optional | Production listening port; defaults to `3000`. |

## 6. Local development / 本地开发

```bash
git clone https://github.com/jomininini/matchwise-manus.git
cd matchwise-manus

corepack enable
pnpm install --frozen-lockfile

# Add the environment variables described above.
pnpm db:push
pnpm dev
```

The development server starts the Express/tRPC backend and the Vite frontend in one process. Open `http://localhost:3000`; if that port is occupied, the application selects the next available port.

## 7. Database setup and migration / 数据库初始化与迁移

The schema contains standard MySQL-compatible tables plus a TiDB-specific `VECTOR(1024)` column. Review generated SQL before applying migrations to a shared or production database.

```bash
# Generate and apply migrations using DATABASE_URL
pnpm db:push
```

For production change control, use the migration files in `drizzle/` as the review artifact, apply them through the platform database migration mechanism, and verify the following tables:

| Table | Purpose |
|---|---|
| `profiles` | Normalized company records and raw source data. |
| `datasetImports` | Official CSV snapshots, status, and import counts. |
| `companyEmbeddings` | One current 1,024-dimensional vector per company. |
| `companyDataActivities` | Edit, enrichment, vector-update, and official-refresh audit history. |
| `savedItems` | Authenticated user bookmarks when OAuth is enabled. |

## 8. Initialize or refresh company data / 初始化公司数据

The recommended operational path is the **Data Management** page:

1. Start the application and open `/admin`.
2. Select **Refresh official data / 刷新官方数据**.
3. The server retrieves the official HKSTP JSON records.[1]
4. Records are normalized and saved as a versioned CSV snapshot.
5. Existing embedding signatures are compared with the new normalized content.
6. OpenRouter generates vectors only for new or changed companies.
7. Profiles, vectors, import metadata, and the governance activity are committed to the database.

The optional script below follows the same incremental vector logic, but it expects the database to contain at least one user record for import attribution:

```bash
pnpm tsx scripts/importOfficialCompanies.mjs
```

## 9. Company Match processing flow / 匹配流程

| Step | Processing |
|---|---|
| 1. Refine | The LLM turns the original requirement into an editable search statement with capabilities, use cases, industries, geography, evidence requirements, retrieval terms, and exclusions. |
| 2. Recall | The refined text is embedded, then TiDB performs cosine-similarity search. Recall is configurable from 1 to 100 candidates. |
| 3. Analyze | The user explicitly starts sequential AI analysis. Each candidate receives suitability, score, rationale, strengths, gaps, and optional verification queries. |
| 4. Export | Only retained candidates are exported after analysis. Export labels follow the active interface language. |

## 10. Validation commands / 验证命令

Run these checks before each deployment:

```bash
pnpm test
pnpm check
pnpm build
```

| Command | Expected result |
|---|---|
| `pnpm test` | Vitest completes with all server, routing, credential, import, vector, and locale tests passing. |
| `pnpm check` | TypeScript exits without diagnostics. |
| `pnpm build` | Vite builds the client and esbuild bundles the Node server into `dist/`. |

## 11. Production deployment / 生产部署

### Manus deployment

The current production instance uses Manus built-in hosting. Configure secrets in the project settings, apply database migrations, run the official-data refresh, validate the four-stage matching flow, and create a project checkpoint. In this project, each saved checkpoint is automatically published.

### Generic Node hosting

Use a Node 22 runtime with outbound HTTPS access, a persistent TiDB database, and the required environment variables.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production pnpm start
```

The platform must inject `PORT`; the server must not be placed behind a proxy that blocks `/api/trpc`, `/api/oauth/callback`, or `/manus-storage/*`. If deploying outside Manus, replace the Forge storage helper or supply a compatible presign service.

| Deployment concern | Requirement |
|---|---|
| Runtime | One Node web-server process; no persistent background worker is required. |
| Database | Persistent TiDB with SSL and vector support. |
| Timeouts | AI enrichment and vector refresh should remain batched; the UI limits enrichment to five companies and vector refresh to twenty per request. |
| Secrets | Keep all server keys outside Git and expose only required `VITE_*` values to the browser. |
| Networking | Allow outbound access to the HKSTP API, OpenRouter, and the configured storage service. |

## 12. Production security checklist / 上线安全清单

The current demo intentionally removes login barriers from Company Match and Data Management. Before a public production rollout, complete the following controls:

- Replace public data-management procedures with an authenticated administrator procedure.
- Add request rate limiting and per-operation quotas for OpenRouter calls.
- Add CSRF protection or strict same-site controls for mutating browser requests.
- Restrict allowed outbound enrichment URLs and retain source evidence.
- Protect the `main` branch and require tests before merge.
- Rotate API keys after demonstrations and whenever credentials may have been exposed.
- Back up relational data before destructive schema or import operations.

## 13. Troubleshooting / 故障排查

| Symptom | Check |
|---|---|
| `DATABASE_URL is required` | Confirm the variable exists in the runtime and is available to migration commands. |
| `OPENROUTER_API_KEY is required` | Add the server-side key and confirm the account can access embeddings and chat completions. |
| Vector migration fails | Confirm the database is TiDB with native vector support rather than a standard MySQL instance. |
| CSV upload fails | Verify `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, and outbound access to the returned signed URL. |
| No match candidates | Confirm company profiles and company embeddings have equal non-zero counts, then refresh changed vectors. |
| Enrichment is slow | Process smaller batches; public company websites may be unavailable or slow. |
| Saved items return `UNAUTHORIZED` | Configure Manus OAuth and sign in, or remove the saved-items navigation for a fully public deployment. |

## 14. References

[1]: https://data.gov.hk/en-data/dataset/hkstp-hkstp-hkstp-company-directory/resource/4e80787d-9721-4d61-954b-691879987f10 "HKSTP Company Directory — DATA.GOV.HK"
[2]: https://openrouter.ai/docs/api-reference/embeddings "OpenRouter Embeddings API"
[3]: https://docs.pingcap.com/tidb/stable/vector-search-overview/ "TiDB Vector Search Overview"
