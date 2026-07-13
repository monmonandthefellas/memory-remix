import { onReady } from "../../core/dom.js";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(Flip, Draggable);

//=======MEMORY LIBRARY========
const library = document.querySelector(".memory-library-section");
const background = document.querySelector(".memory-library-bg");
const list = document.querySelector(".memory-cards-list-wrapper");

// Global draggable variables
let wrapper = null;
let handle = null;
let track = null;
let wrapperDraggable = null;
let handleDraggable = null;
let maxScroll = 0;
let handleMax = 0;

// helper: always work with the up-to-date set of memory cards
function getMemoryCards() {
  return Array.from(document.querySelectorAll(".memory-card"));
}

let isFlipped = false;
let isAnimating = false;
let selectedCard = null; // Track which card is selected

// NEW: remember card to auto-open after flip/active transition
let openCardAfterFlip = null;

/**
 * Recalculate bounds and sync draggable positions
 */
window.recalcLibraryDraggable = function recalcLibraryDraggable() {
  if (!wrapper || !handle || !track) return;

  const wrapperWidth = wrapper.scrollWidth;
  const viewportWidth = wrapper.clientWidth;
  maxScroll = Math.max(0, wrapperWidth - viewportWidth);
  handleMax = Math.max(0, track.clientWidth - handle.clientWidth);

  if (wrapperDraggable && typeof wrapperDraggable.applyBounds === "function") {
    wrapperDraggable.applyBounds({ minX: -maxScroll, maxX: 0 });
  }
  if (handleDraggable && typeof handleDraggable.applyBounds === "function") {
    handleDraggable.applyBounds({ minX: 0, maxX: handleMax });
  }

  let currentX = gsap.getProperty(wrapper, "x") || 0;
  if (currentX > 0) currentX = 0;
  if (currentX < -maxScroll) currentX = -maxScroll;
  gsap.to(wrapper, { x: currentX, duration: 0.3, ease: "power2.out" });

  const handleX = maxScroll === 0 ? 0 : (-currentX / maxScroll) * handleMax;
  gsap.to(handle, { x: handleX, duration: 0.3, ease: "power2.out" });

  if (wrapperDraggable && typeof wrapperDraggable.update === "function")
    wrapperDraggable.update();
};

/**
 * Exit selected state - return to --active (flipped) view
 */
window.exitSelectedState = function exitSelectedState() {
  if (!selectedCard || isAnimating) return;
  isAnimating = true;

  const clickedCard = selectedCard;
  const placeholder = clickedCard.__placeholder;
  const targetRect = placeholder
    ? placeholder.getBoundingClientRect()
    : {
      left: parseFloat(clickedCard.dataset.origLeft) || 0,
      top: parseFloat(clickedCard.dataset.origTop) || 0,
      width: Number(clickedCard.dataset.origWidth) || clickedCard.offsetWidth,
      height:
        Number(clickedCard.dataset.origHeight) || clickedCard.offsetHeight,
    };

  const overlay = document.querySelector(".memory-lightbox");
  const closeBtn = document.querySelector(".memory-lightbox-close");
  // Stop and reset any Howler player inside the selected card so it starts from beginning next time
  try {
    const howlerEl = clickedCard.querySelector(".howler-player,[data-howler]");
    if (howlerEl) {
      const hid = howlerEl.id;
      if (window.howlerSoundInstances && window.howlerSoundInstances[hid]) {
        try {
          // stop resets playback to start
          window.howlerSoundInstances[hid].stop();
        } catch (e) {
          console.warn("Failed to stop howler instance", e);
        }
      }

      // Reset UI pieces if present
      const progressText = howlerEl.querySelector(
        '[data-howler-info="progress"]'
      );
      const timelineBar = howlerEl.querySelector(
        '[data-howler-control="progress"]'
      );
      if (progressText) progressText.textContent = "0:00";
      if (timelineBar) timelineBar.style.width = "0%";
      howlerEl.setAttribute("data-howler-status", "not-playing");
    }
  } catch (e) {
    console.warn("Error while resetting howler on exitSelectedState", e);
  }
  // --- Unmount React Visualizer ---
  const vizContainer = clickedCard.querySelector(".audio-vizualizer");
  if (vizContainer && typeof window.unmountMemoryVisualizer === "function") {
    window.unmountMemoryVisualizer(vizContainer);
  }
  // --------------------------------

  const others = getMemoryCards().filter((c) => c !== clickedCard);
  const innerEl = clickedCard.querySelector(".memory-card-inner");
  const selectedContent = clickedCard.querySelector(
    ".memory-card-selected-content"
  );
  const controls = document.querySelector(".memory-library-controls");

  // Animate fade-out and remove lightbox and close button in parallel
  if (overlay) {
    gsap.to(overlay, {
      opacity: 0,
      duration: 0.2,
      ease: "power2.out",
      onComplete: () => {
        try {
          overlay.remove();
        } catch (e) { }
      },
    });
  }
  if (closeBtn) {
    gsap.to(closeBtn, {
      opacity: 0,
      duration: 0.12,
      ease: "power2.out",
      onComplete: () => {
        try {
          closeBtn.remove();
        } catch (e) { }
      },
    });
  }

  // Timeline:
  // 1) Hide selected content and reset card rotation
  // 2) Animate card back to original position
  // 3) Reset inline styles and return card to DOM flow
  // 4) Show controls and restore other cards
  // 5) Final cleanup (draggable re-enable, bounds recalc)
  const tl = gsap.timeline({
    onComplete: () => {
      // Clear inline filter from all cards
      document.querySelectorAll(".memory-card").forEach((c) => {
        c.style.filter = "";
      });

      // Remove grayscale effect from all cards
      document.querySelectorAll(".memory-card.grayscale").forEach((c) => {
        c.classList.remove("grayscale");
      });

      // Final: re-enable draggable/lenis and recalculate layout
      if (wrapperDraggable && typeof wrapperDraggable.enable === "function") {
        wrapperDraggable.enable();
      }
      if (
        window.lenis &&
        typeof window.lenis.start === "function"
      ) {
        window.lenis.start();
      }

      isAnimating = false;
      selectedCard = null;

      if (typeof window.recalcLibraryDraggable === "function") {
        window.recalcLibraryDraggable();
      }
    },
  });

  // 1) Hide selected content and return card rotation
  // reverse card-specific front/back animation: backContent -> hide, hoverInfo -> show
  const hoverInfo = clickedCard.querySelector(".card-hover-info-wrapper");
  const backContent = clickedCard.querySelector(".card-back-content-wrap");
  if (backContent) {
    tl.to(
      backContent,
      { autoAlpha: 0, filter: "blur(12px)", duration: 0.28, ease: "power2.in" },
      0
    );
  }
  if (hoverInfo) {
    tl.to(
      hoverInfo,
      { autoAlpha: 1, filter: "blur(0px)", duration: 0.36, ease: "power2.out" },
      0.18
    );
  }
  if (selectedContent) {
    tl.to(
      selectedContent,
      { opacity: 0, filter: "blur(18px)", duration: 0.28 },
      0
    );
  }
  if (innerEl) {
    tl.to(innerEl, { rotateY: 0, duration: 0.28, ease: "power2.inOut" }, 0);
  }

  // 2) Animate card back to original position
  tl.to(
    clickedCard,
    {
      left: targetRect.left + "px",
      top: targetRect.top + "px",
      xPercent: 0,
      yPercent: 0,
      width: targetRect.width + "px",
      height: targetRect.height + "px",
      duration: 0.6,
      ease: "power3.inOut",
    },
    ">0"
  );

  // 3) After animation: reset all styles and return card to document flow
  tl.add(() => {
    // Reinsert card before placeholder or back into list
    try {
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(clickedCard, placeholder);
      } else {
        if (list && list.querySelector(".memory-card")) {
          list
            .querySelector(".memory-card")
            .parentNode.insertBefore(
              clickedCard,
              list.querySelector(".memory-card")
            );
        }
      }
    } catch (e) {
      console.warn(
        "Failed to insert selectedCard back to placeholder parent",
        e
      );
    }

    // Remove placeholder
    if (placeholder) {
      placeholder.remove();
      delete clickedCard.__placeholder;
    }

    // Reset all inline styles
    clickedCard.style.position = "";
    clickedCard.style.left = "";
    clickedCard.style.top = "";
    clickedCard.style.width = "";
    clickedCard.style.height = "";
    clickedCard.style.margin = "";
    clickedCard.style.zIndex = "";
    clickedCard.style.transform = "";
    clickedCard.style.willChange = "";
    clickedCard.style.perspective = "";
    clickedCard.style.webkitPerspective = "";

    if (innerEl) {
      innerEl.style.backfaceVisibility = "";
      innerEl.style.transformStyle = "";
      innerEl.style.transform = "";
    }

    // Remove state-related classes
    clickedCard.classList.remove("--selected", "is-expanded", "is-flipped");
    list.classList.remove("--selected");

    // Remove saved data attributes
    clickedCard.removeAttribute("data-orig-left");
    clickedCard.removeAttribute("data-orig-top");
    clickedCard.removeAttribute("data-orig-width");
    clickedCard.removeAttribute("data-orig-height");
    if (clickedCard.dataset.origZIndex)
      clickedCard.removeAttribute("data-orig-z-index");

    // Clear inline filter to let CSS grayscale work again
    // Clear inline filter from all cards
    document.querySelectorAll(".memory-card").forEach((c) => {
      c.style.filter = "";
    });

    // (overlay and closeBtn were already animated and removed above)
  }, ">");

  // 4) Show library controls (if they were hidden) and the remaining cards
  if (controls) {
    tl.to(
      controls,
      {
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.36,
        ease: "power2.out",
        pointerEvents: "auto",
      },
      "<0.02"
    );
  }

  tl.to(
    others,
    {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
      duration: 0.45,
      ease: "power2.out",
      stagger: 0.02,
    },
    "<0.05"
  );
};

/**
 * Enter selected state - expand single card (smooth, no jump) + lightbox + close button
 * height = 80vh, width kept at 3:4 ratio (width = calc(80vh * 3 / 4))
 */
window.enterSelectedState = async function enterSelectedState(clickedCard) {
  if (isAnimating || selectedCard) return;
  if (!clickedCard.classList.contains("active")) return;

  // Block user interactions while animations are running
  isAnimating = true;

  // If draggable exists, temporarily disable it (same as before)
  if (wrapperDraggable && typeof wrapperDraggable.disable === "function") {
    wrapperDraggable.disable();
  }
  if (
    window.lenis &&
    typeof window.lenis.stop === "function"
  ) {
    window.lenis.stop();
  }

  // Ensure the card is flipped. If not, flip it first (rotateY + offset),
  // wait for the flip animation to finish, then continue with the standard expand flow.
  const innerForFlip = clickedCard.querySelector(".memory-card-inner");
  if (innerForFlip && !clickedCard.classList.contains("is-flipped")) {
    // Add class immediately so hover/leave does not conflict with animation
    clickedCard.classList.add("is-flipped");

    await new Promise((resolve) => {
      const flipTl = gsap.timeline({ onComplete: resolve });
      flipTl.to(
        innerForFlip,
        { rotateY: 180, duration: 0.6, ease: "power2.inOut", z: 20 },
        0
      );
      // Visual card offset during flip (same as hover)
      flipTl.to(
        clickedCard,
        { xPercent: -90, duration: 0.6, ease: "power2.inOut" },
        0
      );
    });
  }

  // Small RAF pause for layout stability before reading rect
  await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 8));

  // Read rect after possible flip to guarantee correct coordinates
  const rect = clickedCard.getBoundingClientRect();

  selectedCard = clickedCard;
  const controls = document.querySelector(".memory-library-controls");

  // Save original position/size and original z-index
  clickedCard.dataset.origLeft = rect.left;
  clickedCard.dataset.origTop = rect.top;
  clickedCard.dataset.origWidth = rect.width;
  clickedCard.dataset.origHeight = rect.height;
  const computedZ =
    clickedCard.style.zIndex || getComputedStyle(clickedCard).zIndex || "";
  clickedCard.dataset.origZIndex = computedZ;

  const comp = getComputedStyle(clickedCard);

  const placeholder = document.createElement("div");
  placeholder.className = "memory-card-placeholder";
  placeholder.style.flex = "0 0 " + rect.width + "px";
  placeholder.style.width = rect.width + "px";
  placeholder.style.minWidth = rect.width + "px";
  placeholder.style.height = rect.height + "px";
  placeholder.style.marginTop = comp.marginTop;
  placeholder.style.marginBottom = comp.marginBottom;
  placeholder.style.marginLeft = comp.marginLeft;
  placeholder.style.marginRight = comp.marginRight;
  placeholder.style.boxSizing = "border-box";
  placeholder.style.display = "block";
  placeholder.style.visibility = "hidden";
  placeholder.style.pointerEvents = "none";

  clickedCard.parentNode.insertBefore(placeholder, clickedCard);
  clickedCard.__placeholder = placeholder;

  document.body.appendChild(clickedCard);

  if (!document.querySelector(".memory-lightbox")) {
    const overlay = document.createElement("div");
    overlay.className = "memory-lightbox";
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.6)",
      zIndex: "10000",
      opacity: "0",
      pointerEvents: "auto",
      backdropFilter: "blur(2px)",
    });
    document.body.appendChild(overlay);
    gsap.to(overlay, { opacity: 1, duration: 0.35, ease: "power2.out" });

    const closeBtn = document.createElement("button");
    closeBtn.className = "memory-lightbox-close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.innerHTML = "x";
    Object.assign(closeBtn.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "10006",
      background: "transparent",
      color: "#fff",
      border: "none",
      fontSize: "28px",
      cursor: "pointer",
      padding: "8px",
      lineHeight: "1",
      opacity: "0",
    });
    document.body.appendChild(closeBtn);
    gsap.to(closeBtn, { opacity: 1, duration: 0.35, delay: 0.05 });

    closeBtn.addEventListener("click", () => {
      window.exitSelectedState();
    });
  }

  list.classList.add("--selected");
  clickedCard.classList.add("--selected");

  // Transition card to fixed position and prepare for expansion animation
  clickedCard.style.position = "fixed";
  clickedCard.style.left = rect.left + "px";
  clickedCard.style.top = rect.top + "px";
  clickedCard.style.width = rect.width + "px";
  clickedCard.style.height = rect.height + "px";
  clickedCard.style.margin = "0";
  clickedCard.style.zIndex = "10005";
  clickedCard.style;
  const tl = gsap.timeline({
    onComplete: () => {
      isAnimating = false;
      clickedCard.classList.add("is-expanded");

      // --- Mount React Visualizer ---
      const vizContainer = clickedCard.querySelector(".audio-vizualizer");
      if (vizContainer && typeof window.mountMemoryVisualizer === "function") {
        const howlerEl = clickedCard.querySelector(".howler-player,[data-howler]");
        if (howlerEl) {
          const hid = howlerEl.id;
          const howlInstance = window.howlerSoundInstances ? window.howlerSoundInstances[hid] : null;
          if (howlInstance) {
            window.mountMemoryVisualizer(vizContainer, howlInstance);
          }
        }
      }
      // --------------------------------
    },
  });

  getMemoryCards().forEach((other) => {
    if (other !== clickedCard) {
      tl.to(
        other,
        {
          x: window.innerWidth * 1.05,
          opacity: 0,
          duration: 0.6,
          ease: "power2.in",
        },
        0
      );
    }
  });

  if (controls) {
    tl.to(
      controls,
      {
        opacity: 0,
        filter: "blur(18px)",
        duration: 0.45,
        pointerEvents: "none",
      },
      0
    );
  }

  const inner = clickedCard.querySelector(".memory-card-inner");
  if (inner) {
    gsap.set(inner, {
      rotateY: inner._gsap ? gsap.getProperty(inner, "rotateY") : 0,
    });
  }

  // card-specific front/back pieces for the selected animation
  const hoverInfo = clickedCard.querySelector(".card-hover-info-wrapper");
  const backContent = clickedCard.querySelector(".card-back-content-wrap");

  tl.to(
    clickedCard,
    {
      left: "50%",
      top: "50%",
      xPercent: -50,
      yPercent: -50,
      width: "calc(80vh * 3 / 4)",
      height: "80vh",
      duration: 0.85,
      ease: "power3.out",
    },
    0.02
  );

  const selectedContent = clickedCard.querySelector(
    ".memory-card-selected-content"
  );
  if (selectedContent) {
    tl.fromTo(
      selectedContent,
      { opacity: 0, filter: "blur(18px)" },
      { opacity: 1, filter: "blur(0px)", duration: 0.6 },
      0.6
    );
  }

  // Animate hover -> back content when entering selected state
  if (backContent) {
    // ensure back starts hidden
    gsap.set(backContent, { autoAlpha: 0, filter: "blur(12px)" });
    tl.to(
      backContent,
      { autoAlpha: 1, filter: "blur(0px)", duration: 0.5, ease: "power2.out" },
      0.3
    );
  }
  if (hoverInfo) {
    tl.to(
      hoverInfo,
      { autoAlpha: 0, filter: "blur(12px)", duration: 0.35, ease: "power2.in" },
      0
    );
  }
};

// ========== FLIP ANIMATION WITH FADE SEQUENCE ==========
// Use delegated click handler on the wrapper so newly rendered cards also work
(function setupCardClickDelegation() {
  const container =
    document.querySelector(".memory-cards-list-wrapper") || document;

  container.addEventListener("click", (e) => {
    const card = e.target.closest(".memory-card");
    if (!card) return;

    // If card is selected, do nothing (close only via close button)
    if (selectedCard === card) return;

    // Prevent interactions while animations are running
    if (isAnimating) return;

    // If already flipped, click enters selected state only if flip finished
    if (isFlipped && !selectedCard && !isAnimating) {
      window.enterSelectedState(card);
      return;
    }

    const startFlipFlow = () => {
      if (!library || !library.classList.contains("active")) {
        openCardAfterFlip = card;
      } else {
        openCardAfterFlip = null;
      }

      isFlipped = !isFlipped;
      isAnimating = true;

      const titleWrapper = document.querySelector(".section-title-wrapper");
      const aboutSection = document.querySelector(".about-section");
      const controls = document.querySelector(".memory-library-controls");

      const fadeOutTl = gsap.timeline();
      if (titleWrapper) {
        fadeOutTl.to(
          titleWrapper,
          {
            opacity: 0,
            filter: "blur(18px)",
            duration: 0.6,
            ease: "power2.inOut",
          },
          0
        );
      }
      if (aboutSection) {
        fadeOutTl.to(
          aboutSection,
          {
            opacity: 0,
            filter: "blur(18px)",
            duration: 0.6,
            ease: "power2.inOut",
          },
          0
        );
      }

      fadeOutTl.add(() => {
        let state = Flip.getState(
          ".memory-library-section, .memory-library-bg, .memory-card, .memory-cards-list-wrapper"
        );

        library.classList.toggle("active");
        background.classList.toggle("active");
        list.classList.toggle("active");
        getMemoryCards().forEach((c) => c.classList.toggle("active"));

        setTimeout(() => {
          if (window.lenis && typeof window.lenis.scrollTo === "function") {
            window.lenis.scrollTo(0, { duration: 1.5, easing: (t) => t * (2 - t) });
          }
        }, 100);

        Flip.from(state, {
          scale: true,
          duration: 2,
          rotate: 0,
          ease: "cubic",
          onComplete: () => {
            const fadeInTl = gsap.timeline();
            if (titleWrapper)
              fadeInTl.to(
                titleWrapper,
                {
                  opacity: 1,
                  filter: "blur(0px)",
                  duration: 0.6,
                  ease: "power2.out",
                },
                0
              );
            if (aboutSection)
              fadeInTl.to(
                aboutSection,
                {
                  opacity: 1,
                  filter: "blur(0px)",
                  duration: 0.6,
                  ease: "power2.out",
                },
                0
              );
            if (controls)
              fadeInTl.to(
                controls,
                {
                  opacity: 1,
                  duration: 0.6,
                  ease: "power2.out",
                  pointerEvents: "auto",
                },
                0
              );

            fadeInTl.add(() => {
              if (typeof scroller !== "undefined" && scroller.update)
                scroller.update();
              if (typeof window.recalcLibraryDraggable === "function")
                window.recalcLibraryDraggable();

              if (openCardAfterFlip) {
                const cardToOpen = openCardAfterFlip;
                openCardAfterFlip = null;
                setTimeout(() => {
                  if (!isAnimating && !selectedCard)
                    window.enterSelectedState(cardToOpen);
                }, 120);
              }

              isAnimating = false;
            });
          },
        });

        document.body.classList.toggle("alt-mode");
      });
    };

    const isCompact = !(library && library.classList.contains("active"));
    if (isCompact) {
      isAnimating = true;
      gsap.to(card, {
        y: 0,
        duration: 0.18,
        ease: "power2.in",
        onComplete: () => {
          setTimeout(() => {
            startFlipFlow();
          }, 20);
        },
      });
      return;
    }

    startFlipFlow();
  });
})();

// ========== CARD HOVER ANIMATION ==========
// Replace individual card hover listeners with delegated container approach
// This ensures hover works even after cards are moved or re-rendered
(function setupCardHoverDelegation() {
  const container =
    document.querySelector(".memory-cards-list-wrapper") || document;
  // Helper to always work with the current set of memory cards
  const getCards = () => Array.from(document.querySelectorAll(".memory-card"));

  function applyGrayscaleToOthers(card) {
    getCards().forEach((c) => {
      if (c !== card) c.classList.add("grayscale");
    });
  }
  function removeGrayscaleFromOthers() {
    getCards().forEach((c) => c.classList.remove("grayscale"));
  }

  // Helper animations - replicate the previous hover behavior
  function onCardPointerEnter(card) {
    if (isAnimating || selectedCard) return;

    applyGrayscaleToOthers(card);

    const inner = card.querySelector(".memory-card-inner");
    const isActive =
      library && (library.classList.contains("active") || isFlipped);
    if (isActive) {
      if (inner) {
        gsap.to(inner, {
          rotateY: 180,
          duration: 0.6,
          ease: "power2.inOut",
          z: 20,
        });
      }
      gsap.to(card, {
        xPercent: -90,
        y: 0,
        duration: 0.6,
        ease: "power2.inOut",
      });
      card.classList.add("is-flipped");
    } else {
      gsap.to(card, { y: -10, duration: 0.3, ease: "power2.out" });
    }
  }

  function onCardPointerLeave(card) {
    if (isAnimating || selectedCard) return;

    removeGrayscaleFromOthers();

    const inner = card.querySelector(".memory-card-inner");
    const isActive =
      library && (library.classList.contains("active") || isFlipped);
    if (isActive) {
      if (inner) {
        gsap.to(inner, {
          rotateY: 0,
          duration: 0.6,
          ease: "power2.inOut",
          z: 0,
        });
      }
      gsap.to(card, { xPercent: 0, y: 0, duration: 0.6, ease: "power2.inOut" });
      card.classList.remove("is-flipped");
    } else {
      gsap.to(card, { y: 0, duration: 0.3, ease: "power2.inOut" });
    }
  }

  // Use mouseover/mouseout with relatedTarget check to ignore internal card events
  container.addEventListener("mouseover", (e) => {
    const card = e.target.closest(".memory-card");
    if (!card) return;
    // Ignore if coming from card's internal element
    const from = e.relatedTarget;
    if (from && card.contains(from)) return;
    onCardPointerEnter(card);
  });

  container.addEventListener("mouseout", (e) => {
    const card = e.target.closest(".memory-card");
    if (!card) return;
    // Ignore if going to card's internal element
    const to = e.relatedTarget;
    if (to && card.contains(to)) return;
    onCardPointerLeave(card);
  });
})();

// ========== DRAGGABLE & SEARCH SETUP ==========
onReady(() => {
  wrapper = document.querySelector(".memory-cards-list-wrapper");
  handle = document.querySelector(".memory-slider-handle");
  track = document.querySelector(".memory-slider-track");
  const searchInput = document.querySelector(".custom-search-input");
  const suggestions = document.querySelector(".search-suggestions");

  // Determine language from URL
  const lang = window.location.pathname.startsWith("/es") ? "es" : "en";

  // Text messages
  const messages = {
    en: {
      one: "1 record found",
      many: (n) => `${n} records found`,
      none: "No records found",
    },
    es: {
      one: "1 registro encontrado",
      many: (n) => `${n} registros encontrados`,
      none: "No se encontraron registros",
    },
  };

  // Disable Enter on search
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
      }
    });
  }

  // Initial calculation
  const wrapperWidth = wrapper ? wrapper.scrollWidth : 0;
  const viewportWidth = wrapper ? wrapper.clientWidth : 0;
  maxScroll = Math.max(0, wrapperWidth - viewportWidth);
  handleMax = track
    ? Math.max(0, track.clientWidth - (handle ? handle.clientWidth : 0))
    : 0;

  // Draggable for wrapper
  if (wrapper) {
    wrapperDraggable = Draggable.create(wrapper, {
      type: "x",
      bounds: { minX: -maxScroll, maxX: 0 },
      inertia: true,
      onDrag() {
        const progress = maxScroll === 0 ? 0 : -this.x / maxScroll;
        gsap.to(handle, {
          x: progress * handleMax,
          duration: 0.25,
          ease: "power2.out",
        });
      },
      onThrowUpdate() {
        const progress = maxScroll === 0 ? 0 : -this.x / maxScroll;
        gsap.to(handle, {
          x: progress * handleMax,
          duration: 0.25,
          ease: "power2.out",
        });
      },
    })[0];
  }

  // Draggable for handle
  if (handle) {
    handleDraggable = Draggable.create(handle, {
      type: "x",
      bounds: { minX: 0, maxX: handleMax },
      onDrag() {
        const progress = handleMax === 0 ? 0 : this.x / handleMax;
        gsap.to(wrapper, {
          x: -progress * maxScroll,
          duration: 0.35,
          ease: "power2.out",
        });
        if (wrapperDraggable && typeof wrapperDraggable.update === "function") {
          wrapperDraggable.update();
        }
      },
    })[0];
  }

  gsap.set(wrapper, { display: "flex", gap: "1rem" });

  // Resize listener
  window.addEventListener(
    "resize",
    () => {
      if (typeof window.recalcLibraryDraggable === "function")
        window.recalcLibraryDraggable();
    },
    { passive: true }
  );

  // Initial recalc
  if (typeof window.recalcLibraryDraggable === "function")
    window.recalcLibraryDraggable();

  // Search functionality
  if (searchInput && suggestions) {
    searchInput.addEventListener("input", (e) => {
      const value = e.target.value.trim().toLowerCase();
      const cardsNow = getMemoryCards();

      const resultsText = suggestions.querySelector(".search-results-text");

      if (value.length < 3) {
        suggestions.innerHTML = "";
        suggestions.style.display = "none";
        cardsNow.forEach((card) => (card.style.display = ""));
        if (resultsText) resultsText.textContent = "";
        return;
      }

      const found = [];
      cardsNow.forEach((card) => {
        const headerEls = Array.from(
          card.querySelectorAll(".memory-card-header")
        );
        const textEls = Array.from(card.querySelectorAll(".memory-card-text"));
        const headerText = headerEls
          .map((h) => h.textContent || "")
          .join(" ")
          .toLowerCase();
        const bodyText = textEls
          .map((t) => t.textContent || "")
          .join(" ")
          .toLowerCase();

        const headerDisplay =
          headerEls[0] && headerEls[0].textContent
            ? headerEls[0].textContent.trim()
            : "";
        const textDisplay =
          textEls[0] && textEls[0].textContent
            ? textEls[0].textContent.trim()
            : "";

        if (headerText.includes(value) || bodyText.includes(value)) {
          found.push({ card, headerText, headerDisplay, textDisplay });
        }
      });

      suggestions.innerHTML = "";

      // ---------- UPDATED TEXT OUTPUT ----------
      const info = document.createElement("div");
      info.className = "search-info";
      const infoText = document.createElement("div");
      infoText.className = "search-results-text";

      let text;
      if (found.length === 0) {
        text = messages[lang].none;
      } else if (found.length === 1) {
        text = messages[lang].one;
      } else {
        text = messages[lang].many(found.length);
      }

      infoText.textContent = text;
      info.appendChild(infoText);
      suggestions.appendChild(info);
      // ------------------------------------------

      if (found.length > 0) {
        found.forEach(({ card, headerText, headerDisplay, textDisplay }) => {
          const option = document.createElement("div");
          option.className = "search-suggestion-item";
          const hdr = headerDisplay || headerText || "Unknown Title";
          const txt = textDisplay ? ` by ${textDisplay}` : "";
          option.textContent = hdr + txt;

          option.addEventListener("click", () => {
            const cardRect = card.getBoundingClientRect();
            const wrapperRect = wrapper.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const wrapperCenter = wrapperRect.left + wrapperRect.width / 2;
            const offsetCenter = cardCenter - wrapperCenter;

            let newX = -offsetCenter;
            if (newX > 0) newX = 0;
            if (newX < -maxScroll) newX = -maxScroll;

            if (wrapperDraggable) wrapperDraggable.x = newX;

            gsap.to(wrapper, {
              x: newX,
              duration: 0.35,
              ease: "power2.out",
              onComplete: () => {
                const handleX =
                  maxScroll === 0 ? 0 : (-newX / maxScroll) * handleMax;
                if (handle)
                  gsap.to(handle, {
                    x: handleX,
                    duration: 0.25,
                    ease: "power2.out",
                  });

                if (
                  wrapperDraggable &&
                  typeof wrapperDraggable.update === "function"
                ) {
                  wrapperDraggable.update();
                }

                if (!card.classList.contains("active")) {
                  if (library) library.classList.add("active");
                  if (background) background.classList.add("active");
                  if (list) list.classList.add("active");
                  getMemoryCards().forEach((c) => c.classList.add("active"));
                  isFlipped = true;
                }

                setTimeout(() => {
                  if (!isAnimating && !selectedCard) {
                    window.enterSelectedState(card);
                  }
                }, 140);
              },
            });

            suggestions.innerHTML = "";
            suggestions.style.display = "none";
          });

          suggestions.appendChild(option);
        });
        suggestions.style.display = "block";
      } else {
        suggestions.style.display = "block";
      }
    });
  }
});

// ------- Add this function next to other memory library helpers -------
export function collapseLibraryToCompact() {
  return new Promise((resolve) => {
    // If already animating or library is not active, do nothing
    if (typeof isAnimating !== "undefined" && isAnimating) {
      console.debug("collapseLibraryToCompact: already animating");
      return resolve(false);
    }
    if (!library || !library.classList.contains("active")) {
      console.debug("collapseLibraryToCompact: library not active");
      return resolve(false);
    }

    isAnimating = true;

    const titleWrapper = document.querySelector(".section-title-wrapper");
    const aboutSection = document.querySelector(".about-section");
    const controls = document.querySelector(".memory-library-controls");

    // Capture state before changing DOM/classes
    const state = Flip.getState(
      ".memory-library-section, .memory-library-bg, .memory-card, .memory-cards-list-wrapper"
    );

    // Remove active classes (reverse transition from active state)
    library.classList.remove("active");
    background.classList.remove("active");
    list.classList.remove("active");
    getMemoryCards().forEach((c) => c.classList.remove("active"));

    // Logical flipped state should reflect compact mode
    isFlipped = false;

    // Smooth scroll-to-top (same as open behavior)
    setTimeout(() => {
      if (window.lenis && typeof window.lenis.scrollTo === "function") {
        window.lenis.scrollTo(0, {
          duration: 1.0,
          easing: (t) => t * (2 - t),
        });
      }
    }, 80);

    // Main Flip animation transition
    Flip.from(state, {
      scale: true,
      duration: 1.2,
      rotate: 0,
      ease: "cubic",
      onComplete: () => {
        // Restore visible sections (title/about), and hide controls
        const tl = gsap.timeline();

        if (titleWrapper) {
          tl.to(
            titleWrapper,
            {
              opacity: 1,
              filter: "blur(0px)",
              duration: 0.45,
              ease: "power2.out",
            },
            0
          );
        }
        if (aboutSection) {
          tl.to(
            aboutSection,
            {
              opacity: 1,
              filter: "blur(0px)",
              duration: 0.45,
              ease: "power2.out",
            },
            0
          );
        }

        // Hide controls: fade out and blur, then disable pointer events
        // after the transition completes
        if (controls) {
          tl.to(
            controls,
            {
              opacity: 0,
              filter: "blur(12px)",
              duration: 0.45,
              ease: "power2.out",
              pointerEvents: "none",
            },
            0
          );
        }

        tl.add(() => {
          if (typeof window.recalcLibraryDraggable === "function") {
            window.recalcLibraryDraggable();
          }
          // Animation finished
          isAnimating = false;
          console.debug("collapseLibraryToCompact: animation complete");
          resolve(true);
        });
      },
      onInterrupt: () => {
        // If interrupted, clear animation flag and resolve false
        isAnimating = false;
        console.debug("collapseLibraryToCompact: interrupted");
        resolve(false);
      },
    });

    // Keep compatibility with alt-mode toggle, same as open/flip
    document.body.classList.toggle("alt-mode");
  });
}