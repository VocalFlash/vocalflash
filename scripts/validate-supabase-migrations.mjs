import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase", "migrations");
const manifestPath = path.join(dir, "RECOVERY-MANIFEST.md");
const manifest = fs.readFileSync(manifestPath, "utf8");
const rows = [...manifest.matchAll(/^\| (\d{14}) \| ([a-z0-9_]+) \| (\d{14}_[a-z0-9_]+\.sql) \| (\d+) \| ([a-f0-9]{64}) \|$/gm)]
  .map((m) => ({ version: m[1], name: m[2], file: m[3], chars: Number(m[4]), sha256: m[5] }));

const sqlFiles = fs.readdirSync(dir)
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
  .sort();

if (rows.length !== 15) throw new Error(`Expected 15 manifest rows, found ${rows.length}`);
if (sqlFiles.length !== rows.length) throw new Error(`Manifest/file count mismatch: ${rows.length} vs ${sqlFiles.length}`);
if (new Set(rows.map((row) => row.version)).size !== rows.length) throw new Error("Duplicate migration versions in manifest");
if (new Set(rows.map((row) => row.file)).size !== rows.length) throw new Error("Duplicate migration filenames in manifest");

for (const [index, row] of rows.entries()) {
  if (sqlFiles[index] !== row.file) throw new Error(`Migration order/name mismatch at ${row.version}`);
  if (row.file !== `${row.version}_${row.name}.sql`) throw new Error(`Filename does not match version/name: ${row.file}`);
  const sql = fs.readFileSync(path.join(dir, row.file), "utf8");
  if (sql.length !== row.chars) throw new Error(`SQL length mismatch: ${row.file}`);
  const digest = crypto.createHash("sha256").update(sql, "utf8").digest("hex");
  if (digest !== row.sha256) throw new Error(`SQL checksum mismatch: ${row.file}`);
}
console.log(`Validated ${rows.length} recovered Supabase migration sources, order, lengths and SHA-256 checksums. No SQL executed.`);
