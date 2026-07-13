import { onReady } from "../../core/dom.js";
import { assignCoversToCards } from "./covers.js";
import { initHowlerJSAudioPlayer } from "./card-player.js";

onReady(async function () {
  const SUPABASE_URL =
    window.MEMORY_REMIX_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
  const SUPABASE_ANON_KEY =
    window.MEMORY_REMIX_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "";
  const FALLBACK_BG_MUSIC_URL =
    "https://cdn.prod.website-files.com/690b1740fac56e1386f1e7c1/6932f9b34c465eac46fb626c_background%20music.mp3";

  const wrapper = document.querySelector(".memory-cards-list-wrapper");

  if (!wrapper) {
    console.warn("Memory Library: not found .memory-cards-list-wrapper");
    return;
  }

  const templateCard = wrapper.querySelector(".memory-card");

  if (!templateCard) {
    console.warn("Memory Library: not found template .memory-card");
    return;
  }

  const cardTemplate = templateCard.cloneNode(true);

  function getMockAudioUrl() {
    if (typeof window.getMemoryRemixBgMusicUrl === "function") {
      return window.getMemoryRemixBgMusicUrl();
    }
    return window.MEMORY_REMIX_BG_MUSIC_URL || FALLBACK_BG_MUSIC_URL;
  }

  function getMockMemories() {
    return [
      {
        id: "mock-1",
        name: "Mock User",
        title: "Test Memory Card",
        audio_url: getMockAudioUrl(),
        hint_text: "This is a simulated memory entry to test the card layout.",
        created_at: new Date().toISOString(),
        status: "approved",
      },
      {
        id: "mock-2",
        name: "Another User",
        title: "Second Memory",
        audio_url: getMockAudioUrl(),
        hint_text: "Another mock card to see the grid layout.",
        created_at: new Date().toISOString(),
        status: "approved",
      },
      {
        id: "mock-3",
        name: "Mock User 3",
        title: "Test Memory Card",
        audio_url: getMockAudioUrl(),
        hint_text: "This is a simulated memory entry to test the card layout.",
        created_at: new Date().toISOString(),
        status: "approved",
      },
      {
        id: "mock-4",
        name: "Mock User 4",
        title: "Test Memory Card",
        audio_url: getMockAudioUrl(),
        hint_text: "This is a simulated memory entry to test the card layout.",
        created_at: new Date().toISOString(),
        status: "approved",
      },
      {
        id: "mock-5",
        name: "Mock User 5",
        title: "Test Memory Card",
        audio_url: getMockAudioUrl(),
        hint_text: "This is a simulated memory entry to test the card layout.",
        created_at: new Date().toISOString(),
        status: "approved",
      },
    ];
  }

  function renderCards(memories) {
    const allCards = wrapper.querySelectorAll(".memory-card");
    allCards.forEach((card) => card.remove());

    memories.forEach((memory) => {
      const card = cardTemplate.cloneNode(true);

      const headerEls = Array.from(
        card.querySelectorAll(".memory-card-header")
      );
      const textEls = Array.from(card.querySelectorAll(".memory-card-text"));
      const playerEl = card.querySelector(".howler-player");

      if (headerEls.length) {
        headerEls.forEach((el) => (el.textContent = memory.title || ""));
      }
      if (textEls.length) {
        textEls.forEach((el) => (el.textContent = memory.name || ""));
      }

      const promptEl =
        card.querySelector(".memory-card-prompt") ||
        card.querySelector(".prompt-text");
      const promptText = memory.name ? `by ${memory.name}` : "";
      if (promptEl) {
        promptEl.textContent = promptText;
      } else if (promptText) {
        const backContent = card.querySelector(".card-back-content-wrap");
        if (backContent) {
          const promptDiv = document.createElement("div");
          promptDiv.className = "memory-card-prompt";
          promptDiv.style.fontSize = "14px";
          promptDiv.style.marginTop = "8px";
          promptDiv.style.opacity = "0.7";
          promptDiv.textContent = promptText;
          backContent.appendChild(promptDiv);
        }
      }
      if (playerEl) {
        playerEl.setAttribute("data-howler-src", memory.audio_url || "");
        if (!playerEl.hasAttribute("data-howler")) {
          playerEl.setAttribute("data-howler", "");
        }
        // Template card can already be initialized; reset markers on clones
        // so each rendered card gets fresh listeners and Howl instances.
        playerEl.removeAttribute("data-howler-initialized");
        playerEl.setAttribute("data-howler-status", "not-playing");
        if (playerEl.id) playerEl.removeAttribute("id");
      }

      card.style.display = "";
      wrapper.appendChild(card);
    });

    assignCoversToCards().catch(console.error);

    try {
      initHowlerJSAudioPlayer();
    } catch (err) {
      console.error("Error initializing Howler players:", err);
    }
  }

  async function loadMemories() {
    try {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error(
          "Supabase config missing. Set MEMORY_REMIX_SUPABASE_* or VITE_SUPABASE_*."
        );
      }

      console.log("Fetching memories from Supabase...");

      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      };

      async function fetchMemories(selectFields) {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/memories?status=eq.approved&select=${encodeURIComponent(
            selectFields
          )}`,
          {
            method: "GET",
            headers,
          }
        );
        if (!response.ok) {
          let details = "";
          try {
            details = await response.text();
          } catch (_) {}
          const err = new Error(
            `HTTP error! status: ${response.status}${
              details ? `, body: ${details}` : ""
            }`
          );
          err.status = response.status;
          throw err;
        }
        return response.json();
      }

      const data = await fetchMemories("id,name,title,audio_url,created_at,status");

      if (!data || data.length === 0) {
        console.log("Database empty, using MOCK data for testing...");
        renderCards(getMockMemories());
      } else {
        console.log("Loaded memories from Supabase:", data.length, data);
        renderCards(data);
      }
      setTimeout(() => {
        initHowlerJSAudioPlayer();
      }, 100);
    } catch (err) {
      if (err && (err.status === 401 || err.status === 403)) {
        console.warn(
          "Memory Library auth failed (401/403). Check anon key and RLS policy. Rendering mocks."
        );
      } else {
        console.error("Memory Library fetch error:", err);
      }
      console.log("Rendering MOCK cards as fallback");
      renderCards(getMockMemories());
      setTimeout(() => {
        initHowlerJSAudioPlayer();
      }, 100);
    }
  }

  loadMemories();
});
