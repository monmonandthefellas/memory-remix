import { onReady } from "../core/dom.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

onReady(() => {
  const introScroller = document.querySelector(".intro");
  if (!introScroller) return;

  document.querySelectorAll(".sticky-trigger").forEach((trigger) => {
    const wrapper = trigger.querySelector(".text-appear-wrapper");
    if (!wrapper) return;

    const items = Array.from(wrapper.querySelectorAll("[data-dissolve-text]"));
    if (!items.length) return;

    const appearTl = gsap.timeline({ paused: true });
    appearTl.to(items, {
      opacity: 1,
      filter: "blur(0px)",
      stagger: { amount: 0.6 },
      ease: "power2.out",
    });

    const disappearTl = gsap.timeline({ paused: true });
    disappearTl.to(items, {
      opacity: 0,
      filter: "blur(12px)",
      ease: "power2.in",
    });

    ScrollTrigger.create({
      trigger: trigger,
      scroller: introScroller,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      markers: false,
      onUpdate: (self) => {
        const progress = self.progress;
        if (progress < 0.5) {
          appearTl.progress(progress / 0.5);
          disappearTl.progress(0);
        } else if (progress < 0.7) {
          appearTl.progress(1);
          disappearTl.progress(0);
        } else if (progress < 0.9) {
          disappearTl.progress((progress - 0.7) / 0.2);
        } else {
          disappearTl.progress(1);
        }
      },
    });
  });

  window.addEventListener("load", () => ScrollTrigger.refresh());
});
