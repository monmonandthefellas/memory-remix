/**
 * Generates a manifest for PIXI intro background images.
 *
 * It reads local files from `public/assets/images/` (so you can deploy without GitHub APIs)
 * and writes `public/assets/pixi-intro-bg.json`.
 *
 * Add new `bg-img-*.webp` files to `public/assets/images/` and rebuild — no code changes.
 */
import { readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const IMAGES_DIR = join(ROOT, "public", "assets", "images");
const MANIFEST_PATH = join(ROOT, "public", "assets", "pixi-intro-bg.json");

const DISPLACEMENT_RELATIVE_PATH = "dmaps/2048x2048/fibers.jpg";
const DISPLACEMENT_ABS_PATH = join(IMAGES_DIR, DISPLACEMENT_RELATIVE_PATH);

if (!existsSync(DISPLACEMENT_ABS_PATH)) {
  throw new Error(
    `[generate-pixi-intro-manifest] Missing displacement map: ${DISPLACEMENT_ABS_PATH}`
  );
}

const BG_RE = /^bg-img-(\d+)\.webp$/i;

const files = readdirSync(IMAGES_DIR);
const bgImages = files
  .map((name) => {
    const m = name.match(BG_RE);
    return m ? { idx: Number(m[1]), name } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.idx - b.idx)
  .map((x) => x.name);

if (bgImages.length === 0) {
  throw new Error(
    `[generate-pixi-intro-manifest] No bg images found in ${IMAGES_DIR}`
  );
}

const manifest = {
  bgImages,
  displacementMap: DISPLACEMENT_RELATIVE_PATH,
};

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest), "utf8");
console.log(
  `[generate-pixi-intro-manifest] Wrote manifest with ${bgImages.length} backgrounds to public/assets/pixi-intro-bg.json`
);

