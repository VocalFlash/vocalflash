import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase", "migrations");
const manifestPath = path.join(dir, "RECOVERY-MANIFEST.md");
const manifest = fs.readFileSync(manifestPath, "utf8");
const rows = manifest.split(/\r?\n/)
  .filter((line) => line.startsWith("| 20"))
  .map((line) => {
    const columns = line.split("|").map((column) => column.trim());
    return {
      version: columns[1],
      name: columns[2],
      file: columns[3],
      chars: Number(columns[4]),
      blobSha1: columns[5],
    };
  });

const sqlFiles = fs.readdirSync(dir)
  .filter((name) => /^\d{14}_[a-z0-9_]+\.sql$/.test(name))
  .sort();

if (rows.length !== 15) throw new Error("Expected 15 manifest rows, found " + rows.length);
if (sqlFiles.length !== rows.length) throw new Error("Manifest/file count mismatch: " + rows.length + " vs " + sqlFiles.length);
if (new Set(rows.map((row) => row.version)).size !== rows.length) throw new Error("Duplicate migration versions in manifest");
if (new Set(rows.map((row) => row.file)).size !== rows.length) throw new Error("Duplicate migration filenames in manifest");

for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  if (sqlFiles[index] !== row.file) throw new Error("Migration order/name mismatch at " + row.version);
  if (row.file !== row.version + "_" + row.name + ".sql") throw new Error("Filename does not match version/name: " + row.file);
  const sql = fs.readFileSync(path.join(dir, row.file), "utf8");
  if (sql.length !== row.chars) throw new Error("SQL length mismatch: " + row.file);
  const blobHeader = Buffer.from("blob " + Buffer.byteLength(sql, "utf8") + "\0", "utf8");
  const digest = crypto.createHash("sha1").update(blobHeader).update(sql, "utf8").digest("hex");
  if (digest !== row.blobSha1) throw new Error("Git blob checksum mismatch: " + row.file);
}
console.log("Validated " + rows.length + " recovered Supabase migration sources, order, lengths and Git blob checksums. No SQL executed.");
