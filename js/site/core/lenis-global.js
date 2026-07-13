import { onReady } from "./dom.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis({
  wrapper: document.querySelector(".main-content"),
  content: document.querySelector(".main-content > *"),
  lerp: 0.12,
  smoothWheel: true,
  anchors: true,
});

window.lenis = lenis;

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);

function initScrollToAnchorLenis() {
  document.querySelectorAll("[data-anchor-target]").forEach((element) => {
    element.addEventListener("click", function () {
      const targetScrollToAnchorLenis = this.getAttribute("data-anchor-target");
      lenis.scrollTo(targetScrollToAnchorLenis, {
        easing: (x) =>
          x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2,
        duration: 1.2,
        offset: -100,
      });
    });
  });
}

onReady(() => {
  initScrollToAnchorLenis();
});
