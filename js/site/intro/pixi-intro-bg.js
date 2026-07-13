import * as PIXI from "pixi.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

(async () => {
  const containerElement = document.getElementById("pixi-canvas-container");
  if (!containerElement) return;

  // Hide until ready so we don't flash a blank or half-drawn canvas on load
  containerElement.style.visibility = "hidden";

  const app = new PIXI.Application();
  await app.init({ resizeTo: window });

  app.canvas.style.width = "100%";
  app.canvas.style.height = "100%";
  app.canvas.style.display = "block";

  containerElement.appendChild(app.canvas);
  // Visibility is shown by enter-intro-main when switching to intro; if we're already past enter, keep visible
  if (document.querySelector(".intro.layer.layer-active")) {
    containerElement.style.visibility = "";
  }

  function getAssetsBase() {
    const base = window.MEMORY_REMIX_ASSETS_BASE;
    return base ? String(base).replace(/\/$/, "") : "";
  }

  const assetsBase = getAssetsBase();
  const manifestUrl = assetsBase
    ? `${assetsBase}/assets/pixi-intro-bg.json`
    : "/assets/pixi-intro-bg.json";

  const imagesBase = assetsBase ? `${assetsBase}/assets/images` : "/assets/images";

  const bgFallback = [
    "bg-img-1.webp",
    "bg-img-2.webp",
    "bg-img-3.webp",
    "bg-img-4.webp",
    "bg-img-5.webp",
  ];
  const displacementFallback = "dmaps/2048x2048/fibers.jpg";

  let manifest = null;
  try {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`Manifest HTTP ${res.status}`);
    manifest = await res.json();
  } catch (e) {
    console.warn("[pixi-intro-bg] Failed to load manifest, using fallback:", e);
  }

  const bgFilenames = (manifest && Array.isArray(manifest.bgImages))
    ? manifest.bgImages
    : bgFallback;
  const displacementRelative =
    (manifest && manifest.displacementMap) || displacementFallback;

  const bgImages = bgFilenames.map((name) => `${imagesBase}/${encodeURIComponent(name)}`);
  const displacementUrl = `${imagesBase}/${displacementRelative}`;

  await PIXI.Assets.load([...bgImages, displacementUrl]);

  app.stage.eventMode = "static";
  const container = new PIXI.Container();
  app.stage.addChild(container);

  // Current and next background sprites for smooth transitions
  let currentBg = PIXI.Sprite.from(bgImages[0]);
  currentBg.alpha = 1;
  container.addChild(currentBg);

  // Fit background sprite to cover entire screen without distortion
  function resizeFlagSprite(sprite) {
    // Scale sprite to cover screen without distortion
    const sw = app.screen.width;
    const sh = app.screen.height;
    const iw = sprite.texture.width || 1;
    const ih = sprite.texture.height || 1;
    const scale = Math.max(sw / iw, sh / ih);
    sprite.scale.set(scale, scale);
    // Center the sprite to maintain proper coverage
    sprite.position.set((sw - iw * scale) / 2, (sh - ih * scale) / 2);
  }
  resizeFlagSprite(currentBg);

  window.addEventListener("resize", () => {
    if (currentBg && !currentBg.destroyed) resizeFlagSprite(currentBg);
    if (nextBg && !nextBg.destroyed) resizeFlagSprite(nextBg);
  });

  // Create displacement map for visual effects
  const displacementSprite = PIXI.Sprite.from(
    displacementUrl
  );
  displacementSprite.texture.source.addressMode = "repeat";
  displacementSprite.position = currentBg.position;
  app.stage.addChild(displacementSprite);

  // Displacement filter
  const displacementFilter = new PIXI.DisplacementFilter({
    sprite: displacementSprite,
    scale: { x: 160, y: 200 },
  });
  currentBg.filters = [displacementFilter];

  // Animate displacement map scrolling continuously
  let speed = 0.3;
  app.ticker.add(() => {
    displacementSprite.x += speed;
    if (displacementSprite.x > displacementSprite.width) {
      displacementSprite.x = 0;
    }
  });

  let nextBg = null;
  let currentIndex = 0;
  let crossfadeTl = null;

  function changeBackground(index) {
    if (index < 0 || index >= bgImages.length) return;
    if (index === currentIndex && !crossfadeTl) return;

    // Snap any in-progress transition to its end state (runs onComplete cleanly)
    if (crossfadeTl) {
      crossfadeTl.progress(1);
      crossfadeTl = null;
    }

    if (index === currentIndex) return;
    if (!currentBg || currentBg.destroyed) return;

    const outgoing = currentBg;
    const incoming = PIXI.Sprite.from(bgImages[index]);
    resizeFlagSprite(incoming);
    incoming.alpha = 0;
    container.addChild(incoming);
    incoming.filters = [displacementFilter];
    nextBg = incoming;
    currentIndex = index;

    crossfadeTl = gsap.timeline({
      defaults: { duration: 1.2, ease: "power2.inOut" },
      onComplete() {
        try {
          if (outgoing.parent === container) container.removeChild(outgoing);
          outgoing.destroy();
        } catch (_) { /* already cleaned up */ }
        currentBg = incoming;
        nextBg = null;
        crossfadeTl = null;
      },
    });

    crossfadeTl
      .to(outgoing, { alpha: 0 }, 0)
      .to(incoming, { alpha: 1 }, 0);
  }

  ScrollTrigger.defaults({ immediateRender: false, ease: "power1.inOut" });

  const scrollTriggers = [
    { trigger: ".intro-section-2", bgIndex: 1 },
    { trigger: ".intro-section-3", bgIndex: 2 },
    { trigger: ".intro-section-4", bgIndex: 3 },
    { trigger: ".intro-section-welcome", bgIndex: 4 },
  ];

  scrollTriggers.forEach(({ trigger, bgIndex }) => {
    ScrollTrigger.create({
      trigger: trigger,
      scroller: ".intro",
      start: "top center",
      end: "bottom center",
      onEnter: () => changeBackground(bgIndex),
      onEnterBack: () => changeBackground(bgIndex),
      onLeaveBack: () => changeBackground(bgIndex - 1 >= 0 ? bgIndex - 1 : 0),
    });
  });

  ScrollTrigger.refresh();
})();
