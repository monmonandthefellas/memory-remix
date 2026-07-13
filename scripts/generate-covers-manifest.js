/**
 * Generates public/assets/covers.json from files in public/assets/covers/.
 * Run before deploy so the bundle can fetch the list from your host (e.g. Vercel)
 * instead of GitHub API. Add new images to public/assets/covers/ and rebuild — no code changes.
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const COVERS_DIR = join(ROOT, "public", "assets", "covers");
const MANIFEST_PATH = join(ROOT, "public", "assets", "covers.json");

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;

let filenames = [];
try {
  filenames = readdirSync(COVERS_DIR)
    .filter((name) => IMAGE_EXT.test(name))
    .sort();
} catch (err) {
  console.warn("[generate-covers-manifest] No public/assets/covers dir or read failed:", err.message);
}

writeFileSync(MANIFEST_PATH, JSON.stringify(filenames), "utf8");
console.log("[generate-covers-manifest] Wrote", filenames.length, "covers to public/assets/covers.json");
