import { onReady } from "../../core/dom.js";
import { Howl } from "howler";

export function initHowlerJSAudioPlayer() {
  const howlerElements = document.querySelectorAll("[data-howler]");
  window.howlerSoundInstances = window.howlerSoundInstances || {};

  howlerElements.forEach((element, index) => {
    const uniqueId = element.id || `howler-${index}`;
    const alreadyInitialized =
      element.getAttribute("data-howler-initialized") === "true";

    // Skip only when we truly have a live instance for this element.
    if (
      alreadyInitialized &&
      element.id &&
      window.howlerSoundInstances[element.id]
    ) {
      return;
    }

    element.id = uniqueId;
    element.setAttribute("data-howler-initialized", "true");
    element.setAttribute("data-howler-status", "not-playing");

    const audioSrc = element.getAttribute("data-howler-src");

    if (window.howlerSoundInstances[uniqueId]) {
      try {
        window.howlerSoundInstances[uniqueId].unload();
      } catch (e) {}
      delete window.howlerSoundInstances[uniqueId];
    }

    const durationElement = element.querySelector(
      '[data-howler-info="duration"]'
    );
    const progressTextElement = element.querySelector(
      '[data-howler-info="progress"]'
    );
    const timelineContainer = element.querySelector(
      '[data-howler-control="timeline"]'
    );
    const timelineBar = element.querySelector(
      '[data-howler-control="progress"]'
    );
    const toggleButton = element.querySelector(
      '[data-howler-control="toggle-play"]'
    );

    const icon = element.querySelector(".howler-player-icon");

    const sound = new Howl({
      src: [audioSrc],
      html5: false,
      preload: false,

      onload: () => {
        if (durationElement)
          durationElement.textContent = formatTime(sound.duration());

        toggleButton?.classList.remove("howler-loading");
        icon?.classList.remove("howler-icon-hidden");

        const audioNode = sound._sounds?.[0]?._node;
        if (audioNode) {
          audioNode.addEventListener("pause", () => {
            if (sound.playing()) sound.pause();
          });
          audioNode.addEventListener("play", () => {
            if (!sound.playing()) sound.play();
          });
        }
      },

      onplay: () => {
        toggleButton?.classList.remove("howler-loading");
        icon?.classList.remove("howler-icon-hidden");

        pauseAllExcept(uniqueId);
        element.setAttribute("data-howler-status", "playing");
        requestAnimationFrame(updateProgress);
      },

      onpause: () => element.setAttribute("data-howler-status", "not-playing"),
      onstop: () => element.setAttribute("data-howler-status", "not-playing"),
      onend: resetUI,
    });

    window.howlerSoundInstances[uniqueId] = sound;

    function updateProgress() {
      if (!sound.playing()) return;
      updateUI();
      requestAnimationFrame(updateProgress);
    }

    function updateUI() {
      const currentTime = sound.seek() || 0;
      const duration = sound.duration() || 1;

      if (progressTextElement)
        progressTextElement.textContent = formatTime(currentTime);

      if (timelineBar)
        timelineBar.style.width = `${(currentTime / duration) * 100}%`;

      timelineContainer?.setAttribute(
        "aria-valuenow",
        Math.round((currentTime / duration) * 100)
      );
    }

    function resetUI() {
      if (timelineBar) timelineBar.style.width = "100%";
      element.setAttribute("data-howler-status", "not-playing");
    }

    function seekToPosition(event) {
      const rect = timelineContainer.getBoundingClientRect();
      const percentage = (event.clientX - rect.left) / rect.width;
      sound.seek(sound.duration() * percentage);

      if (!sound.playing()) {
        pauseAllExcept(uniqueId);
        sound.play();
        element.setAttribute("data-howler-status", "playing");
      }

      updateUI();
    }

    function togglePlay() {
      const isPlaying = sound.playing();

      if (!isPlaying && sound.state() !== "loaded") {
        toggleButton?.classList.add("howler-loading");
        icon?.classList.add("howler-icon-hidden");
        sound.load();
      }

      isPlaying ? sound.pause() : (pauseAllExcept(uniqueId), sound.play());
      toggleButton?.setAttribute("aria-pressed", !isPlaying);
    }

    function pauseAllExcept(id) {
      Object.keys(window.howlerSoundInstances).forEach((otherId) => {
        const other = window.howlerSoundInstances[otherId];
        try {
          if (otherId !== id && other.playing()) {
            other.pause();
            document
              .getElementById(otherId)
              ?.setAttribute("data-howler-status", "not-playing");
          }
        } catch (e) {
          console.warn("pauseAllExcept error:", otherId, e);
        }
      });
    }

    function formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${minutes}:${secs.toString().padStart(2, "0")}`;
    }

    toggleButton?.addEventListener("click", togglePlay);
    timelineContainer?.addEventListener("click", seekToPosition);
    sound.on("seek", updateUI);
    sound.on("play", updateUI);
  });

  return window.howlerSoundInstances;
}

onReady(initHowlerJSAudioPlayer);
