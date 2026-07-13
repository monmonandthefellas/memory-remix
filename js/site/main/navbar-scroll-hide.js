import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const nav = document.querySelector(".navbar");
if (nav) {
  const showAnim = gsap
    .from(nav, {
      yPercent: -100,
      paused: true,
      duration: 0.2,
    })
    .progress(1);

  ScrollTrigger.create({
    scroller: ".main-content",
    start: "top top",
    end: 99999,
    onUpdate: (self) => {
      if (self.direction === -1) {
        if (self.scroll() > nav.offsetHeight) {
          showAnim.play();
        }
      } else {
        showAnim.reverse();
      }
    },
  });
}
