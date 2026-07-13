import { onReady } from "../../core/dom.js";

/**
 * Cover images are loaded from a manifest (assets/covers.json) generated at build time.
 * - Same origin (Vercel): use relative paths; base is "".
 * - Embedded in Webflow: set window.MEMORY_REMIX_ASSETS_BASE to your Vercel URL (e.g. "https://your-app.vercel.app").
 * Add images to assets/covers/, run build → no code changes.
 */
const STORAGE_KEY = "memoryCoversV2";

function getAssetsBase() {
  if (typeof window === "undefined") return "";
  const base = window.MEMORY_REMIX_ASSETS_BASE;
  return base ? String(base).replace(/\/$/, "") : "";
}

async function fetchCoverUrls() {
  const base = getAssetsBase();
  const url = base ? `${base}/assets/covers.json` : "/assets/covers.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Covers manifest failed: ${res.status}`);
  const filenames = await res.json();
  if (!Array.isArray(filenames)) return [];
  const basePath = base ? `${base}/assets/covers` : "/assets/covers";
  return filenames.map((name) => `${basePath}/${encodeURIComponent(name)}`);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildAssignmentBySets(images, cardsCount) {
  if (!images.length) return [];

  const m = images.length;
  const out = new Array(cardsCount);
  let lastPlaced = null;

  const fullSets = Math.floor(cardsCount / m);
  const remainder = cardsCount % m;

  const fillSet = (len) => {
    const base = images.slice(0, len);
    shuffle(base);
    if (lastPlaced !== null && base.length > 0 && base[0] === lastPlaced) {
      const j = base.findIndex((v) => v !== lastPlaced);
      if (j > 0) [base[0], base[j]] = [base[j], base[0]];
    }
    for (let i = 1; i < base.length; i++) {
      if (base[i] === base[i - 1]) {
        const j = base.findIndex((v, k) => k > i && v !== base[i - 1]);
        if (j !== -1) [base[i], base[j]] = [base[j], base[i]];
      }
    }
    lastPlaced = base.length ? base[base.length - 1] : lastPlaced;
    return base;
  };

  let cursor = 0;
  for (let s = 0; s < fullSets; s++) {
    const batch = fillSet(m);
    for (let i = 0; i < batch.length; i++) out[cursor++] = batch[i];
  }
  if (remainder > 0) {
    const batch = fillSet(remainder);
    for (let i = 0; i < batch.length; i++) out[cursor++] = batch[i];
  }
  return out;
}

async function getAssignmentForTab(cardsCount) {
  const cached = sessionStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= cardsCount) return parsed;
    } catch {}
  }

  const images = await fetchCoverUrls();
  if (!images.length) return [];

  const assignment = buildAssignmentBySets(images, cardsCount);
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(assignment));
  return assignment;
}

export async function assignCoversToCards() {
  const cards = Array.from(document.querySelectorAll(".memory-card"));
  if (!cards.length) return;

  const assignment = await getAssignmentForTab(cards.length);

  cards.forEach((card, i) => {
    const img = card.querySelector(".memory-card-front .image-memory");
    if (!img) return;
    img.src = assignment[i];
    img.loading = "lazy";
    img.decoding = "async";
  });
}

onReady(() => {
  assignCoversToCards().catch(console.error);
});
