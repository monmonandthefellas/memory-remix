import { onReady } from "../core/dom.js";

(function () {
  const cards = document.querySelectorAll(".slide-card");
  const wrap = document.querySelector(".slides-wrap");
  const avatars = document.querySelectorAll(".avatar-btn");

  if (!cards.length || !wrap) return;

  function setFixedMaxHeight() {
    cards.forEach((card) => (card.style.height = "auto"));

    const maxHeight = Math.max(
      ...Array.from(cards).map((card) => card.scrollHeight)
    );

    wrap.style.height = maxHeight + "px";
    cards.forEach((card) => (card.style.height = maxHeight + "px"));
  }

  function setActive(id) {
    avatars.forEach((a) =>
      a.classList.toggle("active", a.dataset.target === id)
    );
    cards.forEach((card) => card.classList.toggle("active", card.id === id));
  }

  avatars.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.dataset.target;
      if (!id) return;
      setActive(id);
    });
  });

  function handleCardsReady() {
    const imgs = wrap.querySelectorAll("img");
    if (!imgs.length) {
      setFixedMaxHeight();
      return;
    }
    let loaded = 0;
    imgs.forEach((img) => {
      if (img.complete) {
        loaded++;
        if (loaded === imgs.length) setFixedMaxHeight();
      } else {
        img.addEventListener("load", () => {
          loaded++;
          if (loaded === imgs.length) setFixedMaxHeight();
        });
        img.addEventListener("error", () => {
          loaded++;
          if (loaded === imgs.length) setFixedMaxHeight();
        });
      }
    });
  }

  onReady(handleCardsReady);

  const initial =
    document.querySelector(".avatar-btn.active")?.dataset.target ||
    cards[0]?.id;
  if (initial) setActive(initial);
})();
