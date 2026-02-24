import { promises as fs } from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function copyFile(rel) {
  const from = path.join(src, rel);
  const to = path.join(dist, rel);
  await ensureDir(path.dirname(to));
  await fs.copyFile(from, to);
}

async function main() {
  await ensureDir(dist);

  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isFile()) continue;
    await copyFile(e.name);
  }

  // Simple build stamp (non-functional)
  const stamp = new Date().toISOString();
  await fs.writeFile(path.join(dist, "BUILD_INFO.txt"), `Built: ${stamp}\n`, "utf8");
  console.log(`Copied ${entries.filter(e => e.isFile()).length} file(s) from src -> dist`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
