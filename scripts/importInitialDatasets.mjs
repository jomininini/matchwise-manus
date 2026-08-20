import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import mysql from "mysql2/promise";

const sourceRoot = "/home/ubuntu/Matching-source";
const maxFieldLength = 50_000;

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compact(value, limit = maxFieldLength) {
  const cleaned = clean(value);
  return cleaned ? cleaned.slice(0, limit) : null;
}

function first(record, keys) {
  for (const key of keys) {
    const value = clean(record[key]);
    if (value) return value;
  }
  return "";
}

function joined(record, keys) {
  return keys.map(key => clean(record[key])).filter(Boolean).join(" · ");
}

function normalize(sourceType, record, rowIndex, batchId) {
  const id = `${sourceType}-${rowIndex + 1}`;
  let name = "";
  let website = null;
  let sector = null;
  let technology = null;
  let description = null;
  let investmentFocus = null;
  let ticketSize = null;
  let portfolio = null;

  if (sourceType === "company") {
    name = first(record, ["name_EN", "name_TC", "name_SC"]) || `HKSTP company ${rowIndex + 1}`;
    sector = compact(first(record, ["cluster", "cluster_TC", "cluster_SC"]), 255);
    description = compact(joined(record, ["introduction_EN", "introduction_TC", "product_EN", "product_TC"]));
    technology = compact(joined(record, ["product_EN", "product_TC", "product_SC"]));
    website = compact(first(record, ["website"]), 2048);
  } else if (sourceType === "solution") {
    name = first(record, ["Title", "Institute"]) || `HKSTP solution ${rowIndex + 1}`;
    sector = compact(first(record, ["Institute"]), 255);
    description = compact(joined(record, ["web_content_en", "web_content"]));
    technology = description;
    website = compact(first(record, ["Link", "url"]), 2048);
  } else {
    name = first(record, ["INVESTOR", "英文名称"]) || `Investor ${rowIndex + 1}`;
    investmentFocus = compact(first(record, ["主要投资领域", "品牌介绍"]));
    sector = compact(investmentFocus, 255);
    description = compact(joined(record, ["品牌介绍", "主要投资领域"]));
    ticketSize = compact(joined(record, ["管理规模区间(已换算汇率)", "管理规模(记录金额)", "资金币种"]), 255);
    portfolio = compact(joined(record, ["累计投资企业数", "近三个月投资总数", "管理基金数"]));
    website = compact(first(record, ["机构官网"]), 2048);
  }

  const normalizedText = clean([name, sector, technology, description, investmentFocus, ticketSize, portfolio].filter(Boolean).join(" "));
  return [
    id,
    sourceType,
    id,
    name,
    website,
    sector,
    null,
    technology,
    description,
    investmentFocus,
    ticketSize,
    portfolio,
    normalizedText,
    JSON.stringify(record),
    batchId,
  ];
}

async function importDataset(connection, sourceType, fileName) {
  const csv = fs.readFileSync(path.join(sourceRoot, fileName), "utf8");
  const records = parse(csv, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: true, trim: true });
  const batchId = `initial-${sourceType}`;
  console.log(`Preparing ${records.length} ${sourceType} records…`);

  await connection.query("DELETE FROM `profiles` WHERE `sourceType` = ?", [sourceType]);
  await connection.query("DELETE FROM `datasetImports` WHERE `id` = ?", [batchId]);
  await connection.query(
    "INSERT INTO `datasetImports` (`id`, `sourceType`, `fileName`, `recordCount`, `status`, `importedBy`, `completedAt`) VALUES (?, ?, ?, ?, 'processing', 0, NOW())",
    [batchId, sourceType, fileName, records.length],
  );

  const sql = "INSERT INTO `profiles` (`id`, `sourceType`, `recordKey`, `name`, `website`, `sector`, `stage`, `technology`, `description`, `investmentFocus`, `ticketSize`, `portfolio`, `normalizedText`, `rawData`, `importBatchId`) VALUES ?";
  for (let offset = 0; offset < records.length; offset += 250) {
    const rows = records.slice(offset, offset + 250).map((record, index) => normalize(sourceType, record, offset + index, batchId));
    await connection.query(sql, [rows]);
    if ((offset + rows.length) % 5000 === 0 || offset + rows.length === records.length) {
      console.log(`Imported ${Math.min(offset + rows.length, records.length)}/${records.length} ${sourceType} records`);
    }
  }
  await connection.query("UPDATE `datasetImports` SET `status` = 'ready', `completedAt` = NOW() WHERE `id` = ?", [batchId]);
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for initial dataset import.");
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await importDataset(connection, "company", "hkstp_company_directory.csv");
  await importDataset(connection, "solution", "2_solutions.csv");
  await importDataset(connection, "investor", "3_investor.csv");
  console.log("Initial HKSTP datasets imported successfully.");
} finally {
  await connection.end();
}
