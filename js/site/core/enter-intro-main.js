import { onReady } from "./dom.js";
import { gsapTargets } from "./gsap-utils.js";
import gsap from "gsap";
import Lenis from "lenis";

onReady(() => {
  const enterScreen = document.querySelector(".enter-website.layer");
  const introSection = document.querySelector(".intro.layer");
  const mainContent = document.querySelector(".main-content.layer");

  if (!enterScreen || !introSection || !mainContent) {
    console.warn(
      "[enter-intro-main] Missing .enter-website.layer / .intro.layer / .main-content.layer — flow skipped."
    );
    return;
  }

  let lenisIntro = null;
  let lenisMain = null;
  /** Single run: scroll-to-bottom / skip / endIntro do not trigger two fades */
  let introExitQueued = false;

  window.scrollTo(0, 0);

  const pixiContainer = document.getElementById("pixi-canvas-container");
  if (pixiContainer) {
    pixiContainer.style.visibility = "hidden";
    pixiContainer.style.opacity = "0";
  }

  showLayer(enterScreen);
  hideLayer(introSection);
  hideLayer(mainContent);

  function enableIntroLenis() {
    if (lenisIntro) return;
    const scrollContent = introSection.firstElementChild || introSection;
    lenisIntro = new Lenis({
      wrapper: introSection,
      content: scrollContent,
      lerp: 0.12,
      smoothWheel: true,
    });
    function raf(time) {
      if (!lenisIntro) return;
      lenisIntro.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  function destroyIntroLenis() {
    if (lenisIntro) {
      lenisIntro.destroy();
      lenisIntro = null;
    }
  }

  function enableMainLenis() {
    if (lenisMain) return;
    const scrollContent = mainContent.firstElementChild || mainContent;
    lenisMain = new Lenis({
      wrapper: mainContent,
      content: scrollContent,
      lerp: 0.12,
      smoothWheel: true,
    });
    function raf(time) {
      if (!lenisMain) return;
      lenisMain.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  function destroyMainLenis() {
    if (lenisMain) {
      lenisMain.destroy();
      lenisMain = null;
    }
  }

  enterScreen.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='enter']");
    if (btn) switchToIntro();
  });

  enterScreen.addEventListener("click", (e) => {
    if (e.target && e.target.matches("[data-action='skip-intro']")) endIntro();
  });

  introSection.addEventListener("click", (e) => {
    if (e.target && e.target.matches("[data-action='skip-intro']")) endIntro();
  });

  introSection.addEventListener(
    "scroll",
    () => {
      const { scrollTop, scrollHeight, clientHeight } = introSection;
      if (scrollTop + clientHeight >= scrollHeight - 10) endIntro();
    },
    { passive: true }
  );

  function switchToIntro() {
    if (pixiContainer) {
      pixiContainer.style.visibility = "visible";
      pixiContainer.style.opacity = "1";
    }
    hideLayer(enterScreen);
    showLayer(introSection);
    enableScroll(introSection);
    setTopZ(introSection);
    enableIntroLenis();
    destroyMainLenis();
  }

  function endIntro() {
    if (introExitQueued) return;
    introExitQueued = true;
    if (typeof fadeOutMusicAndPlaySfx === "function") {
      fadeOutMusicAndPlaySfx(() => finishIntroTransition());
    } else {
      finishIntroTransition();
    }
  }

  function finishIntroTransition() {

    const bgEl =
      document.querySelector(".intro-bg-image") ||
      document.getElementById("pixi-canvas-container");
    const mainReveal = gsapTargets(".main-content", ".bold-nav-full");

    if (typeof gsap === "undefined") {
      disableScroll(introSection);
      hideLayer(introSection);
      if (bgEl) {
        bgEl.style.visibility = "hidden";
        bgEl.style.opacity = "0";
        bgEl.style.pointerEvents = "none";
      }
      showLayer(mainContent);
      enableScroll(mainContent);
      setTopZ(mainContent);
      enableMainLenis();
      destroyIntroLenis();
      sessionStorage.setItem("introDone", "true");
      return;
    }

    gsap.set(introSection, { autoAlpha: 1, filter: "blur(0px)" });
    if (bgEl) gsap.set(bgEl, { autoAlpha: 1, filter: "blur(0px)" });
    if (mainReveal.length) {
      gsap.set(mainReveal, { autoAlpha: 0, filter: "blur(18px)" });
    }

    const tl = gsap.timeline({ defaults: { ease: "power2.inOut" } });

    tl.to(
      introSection,
      {
        autoAlpha: 0,
        filter: "blur(18px)",
        duration: 0.9,
        onStart: () => {
          introSection.style.pointerEvents = "none";
        },
        onComplete: () => {
          disableScroll(introSection);
          hideLayer(introSection);
          showLayer(mainContent);
          enableScroll(mainContent);
          setTopZ(mainContent);
          enableMainLenis();
          destroyIntroLenis();
          sessionStorage.setItem("introDone", "true");
        },
      },
      0
    );

    if (bgEl) {
      tl.to(
        bgEl,
        {
          autoAlpha: 0,
          filter: "blur(18px)",
          duration: 0.9,
          onStart: () => {
            bgEl.style.pointerEvents = "none";
          },
        },
        0
      );
    }

    if (mainReveal.length) {
      tl.to(
        mainReveal,
        {
          autoAlpha: 1,
          filter: "blur(0px)",
          delay: 0.5,
          duration: 1,
          ease: "power2.out",
          overwrite: true,
        },
        ">"
      );
    }
  }

  function showLayer(layer) {
    layer.classList.add("layer-active");
    layer.style.visibility = "visible";
    layer.style.opacity = "1";
    layer.style.pointerEvents = "auto";
    layer.style.zIndex = "100";
  }

  function hideLayer(layer) {
    layer.classList.remove("layer-active");
    layer.style.visibility = "hidden";
    layer.style.opacity = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "0";
    if (typeof layer.scrollTo === "function") layer.scrollTo(0, 0);
    layer.classList.remove("scrollable");
  }

  function enableScroll(layer) {
    layer.classList.add("scrollable");
    layer.style.overflowY = "auto";
    layer.style.height = "100vh";
  }

  function disableScroll(layer) {
    layer.classList.remove("scrollable");
    layer.style.overflowY = "hidden";
    if (typeof layer.scrollTo === "function") layer.scrollTo(0, 0);
  }

  function setTopZ(layer) {
    [enterScreen, introSection, mainContent].forEach((l) => (l.style.zIndex = "0"));
    if (layer === mainContent) layer.style.zIndex = "98";
    else layer.style.zIndex = "100";
  }
});
