# Memory Remix

An interactive art project that reimagines how we engage with the voices of those we've lost.

## Quick Start

### Installation

```bash
npm install
```

### Development

Start the frontend development server:

```bash
npm run dev
```

The app will open at `http://localhost:5173`

Start backend serverless APIs in a separate terminal:

```bash
npx vercel dev --listen 3000
```

This serves admin endpoints at `http://localhost:3000/api/admin/*`.

### Build for Production

```bash
npm run build
```

This generates optimized files in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
memory-remix/
├── index.html          # Main entry point
├── js/
│   ├── main.js         # Entry: imports site/app.js (ES modules)
│   ├── webflow.js      # Webflow interactions
│   └── site/           # Landing: core / enter / intro / main (see site/README.md)
├── public/
│   ├── css/
│   │   ├── memory-remix.webflow.css
│   │   ├── webflow.css
│   │   └── normalize.css
│   ├── fonts/
│   ├── images/
│   └── assets/
│       ├── covers/     # Album covers
│       ├── images/     # Images and displacement maps
│       └── music/      # Audio files
├── docs/
│   ├── INTEGRATION.md
│   ├── ADMIN_SETUP.md
│   └── BACKEND.md
├── vite.config.js      # Vite configuration
└── package.json        # Project dependencies
```

## Technologies

- **GSAP** - Animation library with ScrollTrigger, Flip, and Draggable plugins
- **PIXI.js** - 2D WebGL renderer for canvas animations
- **Howler.js** - Audio playback library
- **Lenis** - Smooth scroll library
- **Vite** - Next generation frontend build tool

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```env
# Frontend (browser) Supabase settings
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>

# Vite proxy target for /api in local dev
VITE_API_PROXY_TARGET=http://127.0.0.1:3000

# Backend serverless settings
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
ADMIN_EMAIL_ALLOWLIST=admin1@example.com,admin2@example.com

# Existing project settings
VITE_GH_USER=your-github-username
VITE_GH_REPO=your-repo-name
VITE_GH_BRANCH=main
```

For admin moderation to work:
- the signed-in Supabase email must be present in `ADMIN_EMAIL_ALLOWLIST`;
- backend APIs must run (local `vercel dev` or deployed Vercel project).

## Git Ignore

The following files are ignored from version control:
- `search.html`
- `401.html`
- `node_modules/`
- `dist/`
- `.env.local`

## Development Notes

- **Lenis** provides smooth scrolling with custom scroll events
- **FLIP** animations handle layout transitions
- **Displacement mapping** creates the interactive background effect
- **GitHub API** fetches cover images dynamically

## License

©Copyright 2025. All Rights Reserved
