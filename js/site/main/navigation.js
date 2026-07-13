import { onReady } from "../core/dom.js";
import { collapseLibraryToCompact } from "./memory-library/library-ui.js";

function getNavStatusEl() {
  return document.querySelector("[data-navigation-status]");
}

function setNavActive(active) {
  const el = getNavStatusEl();
  if (!el) return;
  el.setAttribute("data-navigation-status", active ? "active" : "not-active");
}

/**
 * Single delegated click handler instead of N listeners per button.
 */
function initBoldFullScreenNavigation() {
  const libraryEl = document.querySelector(".memory-library-section");

  document.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    if (t.closest('[data-navigation-toggle="toggle"]')) {
      const nav = getNavStatusEl();
      if (!nav) return;
      const cur = nav.getAttribute("data-navigation-status");
      setNavActive(cur === "not-active");
      return;
    }

    if (t.closest('[data-navigation-toggle="close"]')) {
      setNavActive(false);
      return;
    }

    const menuItem = t.closest(".bold-nav-full__li, [data-closes-library]");
    if (!menuItem) return;

    const shouldCloseLibrary =
      menuItem.dataset.closesLibrary === "true" ||
      menuItem.hasAttribute("data-closes-library");

    if (
      shouldCloseLibrary &&
      libraryEl &&
      libraryEl.classList.contains("active")
    ) {
      e.preventDefault();
      try {
        await collapseLibraryToCompact();
      } catch (err) {
        console.error("Error while collapsing library:", err);
      }
    }

    setNavActive(false);
  });
}

onReady(() => {
  initBoldFullScreenNavigation();
});
