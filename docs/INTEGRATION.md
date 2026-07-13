# Memory Remix Widget — Webflow Integration Guide

## Overview

Memory Remix is an audio recording and mixing widget that allows users to:
- Upload audio tracks (MP3/WAV)
- Record voice over the track
- Add drum beats (kick, snare, hi-hat) with metronome
- Adjust volume and pitch
- Export the final mix as MP3 (~5-6MB for 5-6 min track)

All third-party libraries (GSAP, Howler, PIXI.js, Lenis) are bundled into the JS files via ES imports.
No external CDN `<script>` tags are required — just two JS files and one CSS file.

---

## Required Files

Use these files from your deployed Vercel domain (recommended) or upload them to your own CDN:

| File | Location | Description |
|------|----------|-------------|
| `dist/bundle.js` | `/bundle.js` | React widget bundle (audio recorder/mixer) |
| `dist/js/main.js` | `/js/main.js` | Landing runtime — includes GSAP, Howler, PIXI.js, Lenis (all bundled) |
| `dist/assets/style.css` | `/assets/style.css` | Widget styles |
| `dist/assets/covers.json` + `dist/assets/covers/*` | `/assets/covers...` | Memory card cover manifest + images |
| `dist/assets/pixi-intro-bg.json` + `dist/assets/images/*` | `/assets/pixi-intro-bg.json` and `/assets/images/...` | PIXI intro background manifest + images/displacement map |
| `dist/assets/samples/*.mp3` | `/assets/samples/...` | Drum samples (kick, snare, hihat) |

---

## Quick Start (2 Steps)

### Step 1: Add Container

Place this `<div>` where you want the widget to appear:

```html
<div 
  id="memory-remix"
  data-kick-url="./assets/samples/TR-808_Kick.mp3"
  data-snare-url="./assets/samples/TR-808_Snare.mp3"
  data-hihat-url="./assets/samples/TR-808_HiHat.mp3"
></div>
```

### Step 2: Add Scripts

Add these to your page (in `<head>` or before `</body>`):

```html
<!-- Configuration (before any scripts) -->
<script>
  window.MEMORY_REMIX_SUPABASE_URL = "https://your-project-ref.supabase.co";
  window.MEMORY_REMIX_SUPABASE_ANON_KEY = "your-anon-key";
  window.MEMORY_REMIX_ASSETS_BASE = "https://your-vercel-domain.com";
  // Optional: override enter-screen background music URL
  window.MEMORY_REMIX_BG_MUSIC_URL = "https://your-vercel-domain.com/assets/music/test%20song.mp3";
</script>

<!-- Widget Styles -->
<link href="https://your-vercel-domain.com/assets/style.css" rel="stylesheet">

<!-- Landing runtime (all animations, intro, memory library — libraries bundled inside) -->
<script type="module" src="https://your-vercel-domain.com/js/main.js"></script>

<!-- React widget bundle -->
<script type="module" src="https://your-vercel-domain.com/bundle.js"></script>
```

**That's it!** No CDN scripts for GSAP/Howler/PIXI/Lenis — they are all bundled. jQuery is only needed if you use `webflow.js` (Webflow loads it automatically). The widget will automatically mount to `#memory-remix`.

---

## Configuration Attributes

| Attribute | Required | Default | Description |
|-----------|----------|---------|-------------|
| `id` | ✅ Yes | `memory-remix` | Container ID (must be exactly this) |
| `data-kick-url` | ✅ Yes | — | URL to kick drum sample (MP3) |
| `data-snare-url` | ✅ Yes | — | URL to snare drum sample (MP3) |
| `data-hihat-url` | ✅ Yes | — | URL to hi-hat drum sample (MP3) |
| `data-debug` | ❌ No | `false` | Show latency debug panel |

---

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Memory Remix</title>
  <script>
    window.MEMORY_REMIX_ASSETS_BASE = "https://your-vercel-domain.com";
  </script>
  <link href="https://your-vercel-domain.com/assets/style.css" rel="stylesheet">
</head>
<body>

  <!-- Widget Container -->
  <div 
    id="memory-remix"
    data-kick-url="https://your-cdn.com/samples/kick.mp3"
    data-snare-url="https://your-cdn.com/samples/snare.mp3"
    data-hihat-url="https://your-cdn.com/samples/hihat.mp3"
  ></div>

  <!-- Landing runtime -->
  <script type="module" src="https://your-vercel-domain.com/js/main.js"></script>

  <!-- Widget bundle -->
  <script type="module" src="https://your-vercel-domain.com/bundle.js"></script>

</body>
</html>
```

---

## Webflow-Specific Notes

### Custom Code Setup

1. **Head Code** (Project Settings → Custom Code → Head):
```html
<script>
  window.MEMORY_REMIX_SUPABASE_URL = "https://your-project-ref.supabase.co";
  window.MEMORY_REMIX_SUPABASE_ANON_KEY = "your-anon-key";
  window.MEMORY_REMIX_ASSETS_BASE = "https://your-vercel-domain.com";
  // Optional: override enter-screen background music URL
  window.MEMORY_REMIX_BG_MUSIC_URL = "https://file-url.com/test%20song.mp3";
</script>
<link href="https://your-vercel-domain.com/assets/style.css" rel="stylesheet" type="text/css">
```

2. **Footer Code** (Project Settings → Custom Code → Footer):
```html
<!-- No CDN scripts needed — all libraries are bundled -->
<script type="module" src="https://your-vercel-domain.com/js/main.js"></script>
<script type="module" src="https://your-vercel-domain.com/bundle.js"></script>
```

### Where to find files after build

Run:

```bash
npm run build
```

Then use files from `dist/`:

- `dist/bundle.js` → `https://your-vercel-domain.com/bundle.js`
- `dist/js/main.js` → `https://your-vercel-domain.com/js/main.js`
- `dist/assets/style.css` → `https://your-vercel-domain.com/assets/style.css`
- `dist/assets/covers.json` and `dist/assets/covers/*`
- `dist/assets/pixi-intro-bg.json` and `dist/assets/images/*`
- `dist/assets/samples/*`

### Container Setup

The widget expects a container with **fixed dimensions**. Recommended parent styles:

```css
.music-creation-content-wrapper {
  width: 100%;
  min-height: 600px;
  display: flex;
  justify-content: center;
  align-items: center;
}
```

---

## Supabase Integration

The widget includes submission functionality that requires Supabase. The configuration is in:
- `src/supabaseClient.js` — Supabase URL and anon key

Submissions are stored in:
- **Storage Bucket**: `audios` (public folder)
- **Database Table**: `submissions`

---

## Audio Export Details

| Format | Size (5 min track) | Quality |
|--------|-------------------|---------|
| MP3 | ~5-6 MB | 128kbps stereo |
| WAV (fallback) | ~60 MB | 16-bit PCM |

- **Timeout**: If MP3 encoding exceeds 60 seconds, automatically falls back to WAV
- **Processing UI**: Shows spinner and "PROCESSING" text during export

---

## Browser Support

| Browser | Supported |
|---------|-----------|
| Chrome 80+ | ✅ |
| Firefox 75+ | ✅ |
| Safari 14+ | ✅ |
| Edge 80+ | ✅ |
| Mobile browsers | ⚠️ Limited (microphone access varies) |

---

## Troubleshooting

### Widget Not Appearing
1. Check if `#memory-remix` div exists in DOM
2. Verify bundle.js is loaded
3. Check browser console for errors

### Audio Not Playing
1. User must interact with page first (browser autoplay policy)
2. Check sample URLs are accessible (CORS)

### Microphone Not Working
1. Site must be served over HTTPS
2. User must grant microphone permission
3. Check if another app is using the microphone

---

## Development

```bash
# Install dependencies
npm install

# Development server (with hot reload)
npm run dev

# Production build
npm run build
```

Output files are in `dist/` folder.

---

## Contact

For technical issues, contact the development team.
