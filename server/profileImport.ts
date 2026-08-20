import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";

export type SourceType = "company" | "solution" | "investor";
export type CsvRecord = Record<string, string>;

export type NormalizedProfileInput = {
  id: string;
  sourceType: SourceType;
  recordKey: string;
  name: string;
  website: string | null;
  sector: string | null;
  stage: string | null;
  technology: string | null;
  description: string | null;
  investmentFocus: string | null;
  ticketSize: string | null;
  portfolio: string | null;
  normalizedText: string;
  rawData: CsvRecord;
  importBatchId: string;
};

const maxFieldLength = 50_000;

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string | null {
  const cleaned = clean(value);
  return cleaned ? cleaned.slice(0, maxFieldLength) : null;
}

function first(record: CsvRecord, keys: string[]): string {
  for (const key of keys) {
    const value = clean(record[key]);
    if (value) return value;
  }
  return "";
}

function joined(record: CsvRecord, keys: string[]): string {
  return keys
    .map(key => clean(record[key]))
    .filter(Boolean)
    .join(" · ");
}

export function parseCsvDataset(csv: string): CsvRecord[] {
  return parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as CsvRecord[];
}

export function normalizeDatasetRecord(
  sourceType: SourceType,
  record: CsvRecord,
  rowIndex: number,
  importBatchId: string,
): NormalizedProfileInput {
  const recordKey = `${sourceType}-${rowIndex + 1}`;
  const common = {
    id: recordKey,
    sourceType,
    recordKey,
    stage: null,
    ticketSize: null,
    portfolio: null,
    importBatchId,
    rawData: record,
  } as const;

  if (sourceType === "company") {
    const name = first(record, ["name_EN", "name_TC", "name_SC"]) || `HKSTP company ${rowIndex + 1}`;
    const sector = first(record, ["cluster", "cluster_TC", "cluster_SC"]);
    const description = joined(record, ["introduction_EN", "introduction_TC", "product_EN", "product_TC"]);
    const technology = joined(record, ["product_EN", "product_TC", "product_SC"]);
    return {
      ...common,
      name,
      website: compact(first(record, ["website"])),
      sector: compact(sector),
      technology: compact(technology),
      description: compact(description),
      investmentFocus: null,
      normalizedText: clean([name, sector, description, technology].filter(Boolean).join(" ")),
    };
  }

  if (sourceType === "solution") {
    const name = first(record, ["Title", "Institute"]) || `HKSTP solution ${rowIndex + 1}`;
    const sector = first(record, ["Institute"]);
    const description = joined(record, ["web_content_en", "web_content"]);
    return {
      ...common,
      name,
      website: compact(first(record, ["Link", "url"])),
      sector: compact(sector),
      technology: compact(description),
      description: compact(description),
      investmentFocus: null,
      normalizedText: clean([name, sector, description].filter(Boolean).join(" ")),
    };
  }

  const name = first(record, ["INVESTOR", "英文名称"]) || `Investor ${rowIndex + 1}`;
  const investmentFocus = first(record, ["主要投资领域", "品牌介绍"]);
  const description = joined(record, ["品牌介绍", "主要投资领域"]);
  const ticketSize = joined(record, ["管理规模区间(已换算汇率)", "管理规模(记录金额)", "资金币种"]);
  const portfolio = joined(record, ["累计投资企业数", "近三个月投资总数", "管理基金数"]);
  return {
    ...common,
    name,
    website: compact(first(record, ["机构官网"])),
    sector: compact(investmentFocus),
    technology: null,
    description: compact(description),
    investmentFocus: compact(investmentFocus),
    ticketSize: compact(ticketSize),
    portfolio: compact(portfolio),
    normalizedText: clean([name, investmentFocus, description, ticketSize, portfolio].filter(Boolean).join(" ")),
  };
}

export function normalizeCsvDataset(
  sourceType: SourceType,
  csv: string,
  importBatchId: string,
): NormalizedProfileInput[] {
  return parseCsvDataset(csv).map((record, index) =>
    normalizeDatasetRecord(sourceType, record, index, importBatchId),
  );
}

export type OfficialCompanyRecord = Record<string, string | null | undefined>;

function stableCompanyKey(record: OfficialCompanyRecord, rowIndex: number) {
  const seed = clean([record.name_EN, record.name_TC, record.name_SC, record.website].filter(Boolean).join("|")) || `row-${rowIndex + 1}`;
  return `company-${createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

export function normalizeOfficialCompanyRecords(records: OfficialCompanyRecord[], importBatchId: string): NormalizedProfileInput[] {
  return records.map((officialRecord, rowIndex) => {
    const record = Object.fromEntries(Object.entries(officialRecord).map(([key, value]) => [key, clean(value)]));
    const profile = normalizeDatasetRecord("company", record, rowIndex, importBatchId);
    const id = stableCompanyKey(officialRecord, rowIndex);
    return { ...profile, id, recordKey: id, rawData: record };
  });
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function officialRecordsToCsv(records: OfficialCompanyRecord[]) {
  const columns = Array.from(new Set(records.flatMap(record => Object.keys(record))));
  return [columns.join(","), ...records.map(record => columns.map(column => csvCell(record[column])).join(","))].join("\n");
}
