import { onReady } from "../core/dom.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

onReady(function () {

  const bar = document.querySelector(".ring .bar");
  if (!bar) {
    console.warn("Progress circle .ring .bar not found");
    return;
  }

  const R = 52;
  const C = 2 * Math.PI * R;

  bar.style.strokeDasharray = C;
  bar.style.strokeDashoffset = C;

  ScrollTrigger.create({
    trigger: ".intro-trigger-wrap",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    scroller: ".intro",
    onUpdate(self) {
      const p = gsap.utils.clamp(0, 1, self.progress);
      bar.style.strokeDashoffset = C * (1 - p);
    },
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
});
