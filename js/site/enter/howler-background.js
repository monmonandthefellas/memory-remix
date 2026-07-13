import gsap from "gsap";
import { Howl, Howler } from "howler";

// Non-technical config: replace this URL (or set window.MEMORY_REMIX_BG_MUSIC_URL)
const DEFAULT_BG_MUSIC_URL =
  "https://cdn.prod.website-files.com/690b1740fac56e1386f1e7c1/6932f9b34c465eac46fb626c_background%20music.mp3";

function resolveBgMusicUrl({ withCacheBuster = false } = {}) {
  const baseUrl = window.MEMORY_REMIX_BG_MUSIC_URL || DEFAULT_BG_MUSIC_URL;
  if (!withCacheBuster) return baseUrl;

  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}v=${Date.now()}`;
}

// Expose for other modules (e.g. memory-library mocks).
window.getMemoryRemixBgMusicUrl = resolveBgMusicUrl;

document.addEventListener("DOMContentLoaded", () => {
  let started = false;
  let introPlayed = false;

  const unlockOnce = () => {
    if (Howler.ctx && Howler.ctx.state === "suspended") {
      Howler.ctx.resume();
    }
    document.removeEventListener("click", unlockOnce);
    document.removeEventListener("touchstart", unlockOnce);
  };
  document.addEventListener("click", unlockOnce);
  document.addEventListener("touchstart", unlockOnce);

  const getBgMusicUrl = () => resolveBgMusicUrl({ withCacheBuster: true });

  let bgSrc = getBgMusicUrl();

  let bg = new Howl({
    src: [bgSrc],
    volume: 0.5,
    loop: true,
  });

  function reloadBgMusic() {
    if (bg) bg.unload();
    bgSrc = getBgMusicUrl();
    bg = new Howl({
      src: [bgSrc],
      volume: 0.5,
      loop: true,
    });
  }

  window.fadeOutMusicAndPlaySfx = function (done) {
    if (bg.playing()) {
      bg.fade(bg.volume(), 0, 1200);
      setTimeout(() => {
        bg.stop();
        if (typeof done === "function") done();
      }, 1250);
    } else {
      if (typeof done === "function") done();
    }
  };

  function updateSoundButton() {
    const muted = Howler._muted === true;
    const btn = document.querySelector(".sound-toggle");
    if (!btn) return;
    btn.classList.toggle("is-muted", muted);
    btn.setAttribute("aria-pressed", muted ? "true" : "false");
    btn.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  }

  function buildIntroTimeline() {
    const overlay = document.querySelector(".enter-website");
    const introControls = document.querySelector(".intro-controls-wrapper");
    const introProgress = document.querySelector(".intro-progress-wrapper");

    const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

    if (overlay) {
      tl.add(() => {
        overlay.style.pointerEvents = "none";
      }, 0);
      tl.to(
        overlay,
        { opacity: 0, filter: "blur(18px)", duration: 1.6 },
        0
      );
      tl.add(() => {
        document.body.classList.remove("no-scroll");
        overlay.style.display = "none";
      });
    } else {
      tl.add(() => {
        document.body.classList.remove("no-scroll");
      });
    }

    if (introControls) {
      tl.fromTo(
        introControls,
        { opacity: 0, filter: "blur(8px)" },
        {
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.6,
          ease: "power2.out",
        }
      );
    }

    if (introProgress) {
      const position = introControls ? ">-0.3" : 0;
      tl.fromTo(
        introProgress,
        { opacity: 0, filter: "blur(12px)" },
        {
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.6,
          ease: "power2.out",
        },
        position
      );
    }

    return tl;
  }

  function runIntroOnce() {
    if (introPlayed) return;
    introPlayed = true;
    buildIntroTimeline().play(0);
  }

  function handleEnterWithMusic() {
    started = true;
    reloadBgMusic();
    Howler.mute(false);
    bg.play();
    updateSoundButton();
    runIntroOnce();
  }

  function handleEnterWithoutMusic() {
    started = true;
    Howler.mute(true);
    if (bg.playing()) bg.stop();
    updateSoundButton();
    runIntroOnce();
  }

  document.getElementById("start")?.addEventListener("click", handleEnterWithMusic);
  document.getElementById("start-no-music")?.addEventListener("click", handleEnterWithoutMusic);

  document.querySelector(".sound-toggle")?.addEventListener("click", function () {
    const willMute = !this.classList.contains("is-muted");
    Howler.mute(willMute);
    if (!willMute && started && !bg.playing()) {
      bg.play();
    }
    updateSoundButton();
  });

  document.querySelector(".sound-toggle")?.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const willMute = !this.classList.contains("is-muted");
    Howler.mute(willMute);
    if (!willMute && started && !bg.playing()) {
      bg.play();
    }
    updateSoundButton();
  });

  updateSoundButton();
});
