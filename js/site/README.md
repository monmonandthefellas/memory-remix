# `js/site` — landing (ES modules)

| Folder | Contents |
|--------|----------|
| **core/** | `dom.js`, `gsap-utils.js`, `mic-modal.js`, **`lenis-global.js`** (main scroll), **`enter-intro-main.js`** (enter → intro → main layers) |
| **enter/** | Enter screen: Howler + timeline after Enter |
| **intro/** | Intro content only: PIXI background, progress ring, dissolve text |
| **main/** | Navbar, clock, about, **`memory-library/`** (cards, API, UI), navigation |

Entry: `app.js` ← `js/main.js`.

**Cover images:** Built from `assets/covers/`; `npm run build` generates `assets/covers.json`. Covers are loaded from your host (same origin or `window.MEMORY_REMIX_ASSETS_BASE` when embedded e.g. in Webflow).
