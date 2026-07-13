# Memory Remix Staging - Technical Handoff (Frontend + Backend)

## 1. Current Status

This document is a single handoff for engineering (Bogdan) and reflects the current implementation state in `memory-remix-staging`.

Completed:
- Secure admin moderation backend on Vercel API routes.
- Supabase migration for moderation status and placeholder prompt fields.
- Strict RLS on `public.memories` (public insert only, no public read).
- Admin frontend with login, submission list/detail, audio playback, approve/reject.
- Route support for `/admin`, `/admin-login`, and `/dashboard` (alias).

Not completed (waiting on client content):
- Final client copy for prompt text/field naming.

## 2. Runtime Architecture

Public side:
- Webflow-hosted widget uses built static assets from `dist/`.
- Public submission currently sends `name`, `email`, `title`, `audio_url`, `status=pending`.

Admin side:
- Private admin app runs inside same frontend bundle.
- Auth via Supabase email/password session.
- Admin data operations go through Vercel serverless API (`/api/admin/*`).

Backend side:
- Vercel serverless functions (`api/`) with Supabase service-role client.
- Admin authorization enforced by bearer token + allowlist.

## 3. Key Files

Frontend admin:
- `src/main.jsx` (admin route detection and mount)
- `src/admin/AdminRoot.jsx` (session gate, login/logout, route guard)
- `src/admin/AdminApp.jsx` (table, modal, audio player, approve/reject)
- `src/admin/apiClient.js` (authorized API calls)
- `src/admin/admin.css` (admin styles)

Backend:
- `api/_lib/supabaseAdmin.js` (service-role client + env resolution)
- `api/_lib/requireAdmin.js` (bearer token validation + allowlist check)
- `api/admin/submissions/index.js` (`GET` list with filters/pagination)
- `api/admin/submissions/[id].js` (`GET` detail and `PATCH` status)

Database:
- `supabase/migrations/20260226_memories_admin_backend.sql`

Routing/deploy:
- `vercel.json` (rewrites for `/admin`, `/admin-login`, `/dashboard`, `/api/*`)
- `build-vercel.js` (build pipeline for Webflow deployment artifact generation)

## 4. Admin UX Behavior (Implemented)

Login and access:
- `/admin-login` shows email/password login form.
- `/admin` is protected: no session redirects to `/admin-login`.
- `/dashboard` works as alias and normalizes to `/admin`.
- Logged-in users still require allowlisted email server-side.

Submission review:
- Status filters: `all`, `pending`, `approved`, `rejected`.
- Pagination with per-page selector.
- Detail modal includes:
  - metadata (`name`, `email`, `title`)
  - `audio_url`
  - inline audio player (play/pause/seek/volume)
  - action buttons: `Approve` / `Reject`
- placeholder fields display: `new_question_1`, `new_question_2`

## 5. API Contract

Base path:
- `/api/admin/submissions`

Auth header (all endpoints):
- `Authorization: Bearer <supabase_access_token>`

### 5.1 GET `/api/admin/submissions`

Query params:
- `status=all|pending|approved|rejected` (default `all`)
- `limit` integer `1..200` (default `50`)
- `offset` integer `>=0` (default `0`)

Returns:
- `200` with `{ data, pagination, filter }`

### 5.2 GET `/api/admin/submissions/:id`

Returns:
- `200` with `{ data }` for one submission.

### 5.3 PATCH `/api/admin/submissions/:id`

Body:
```json
{ "status": "approved" }
```
or
```json
{ "status": "rejected" }
```

Returns:
- `200` with `{ data, message: "status_updated" }`

### 5.4 Error semantics

- `400` invalid params/body/id/status
- `401` missing/invalid/expired token
- `403` valid token but not allowlisted
- `404` row not found
- `405` wrong method
- `500` server/db configuration or query failure

## 6. Database and Security

Table:
- `public.memories`

Schema updates:
- `status` normalized to enum `public.memory_status`:
  - `pending`, `approved`, `rejected`
- Added nullable placeholder columns:
  - `new_question_1 text`
  - `new_question_2 text`
- Index:
  - `memories_status_created_at_idx (status, created_at desc)`

RLS:
- RLS enabled and forced on `public.memories`.
- Existing policies dropped and replaced.
- Public roles (`anon`, `authenticated`) can only `INSERT` with `status='pending'`.
- Public read is blocked.

## 7. Environment Variables

Required frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Required backend:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL_ALLOWLIST` (comma-separated emails)

Notes:
- Service-role key must never be exposed in client code.
- Local helper has `.env.local` fallback for dev reliability.

## 8. Local Development and Testing

### 8.1 Which dev server to use

- `npm run dev` (Vite, usually `:5173`): frontend only.
- `vercel dev` (usually `:3000`): frontend + serverless API.

To test admin end-to-end, use `vercel dev`.

### 8.2 Minimal verification checklist

1. Login on `/admin-login` succeeds.
2. `/admin` loads list.
3. Detail opens for a row.
4. Audio can play for valid `audio_url`.
5. Approve/reject updates status.
6. Non-allowlisted user gets `403` from API.
7. Public anon select from `memories` is blocked by RLS.

## 9. Deployment Notes

For fork workflow:
- Do not push `dist/` on every feature iteration.
- Push source + migration + API + admin app first.

For client original repo/Webflow delivery:
1. Merge source changes.
2. Run production build.
3. Publish/update required static artifacts (`dist/`) if deployment flow expects committed build output.
4. Ensure Vercel env vars are configured in target project.

## 10. Prompt and Field Content Handoff (Current Reality)

Current implementation uses placeholder database fields:
- `new_question_1`
- `new_question_2`

Admin UI already displays these fields in the detail modal.

Current behavior:
- Public submission form includes temporary inputs for these values and submits them end-to-end (`src/components/SubmissionSidebar.jsx`, `src/hooks/useSubmission.js`).
- If user leaves them empty, backend stores safe placeholder defaults:
  - `[CLIENT QUESTION 1 PLACEHOLDER]`
  - `[CLIENT PROMPT 1 PLACEHOLDER]`

## 11. Recommendation for Next Action

- Confirm with Monica whether prompt fields are user-input fields or admin/internal text fields.
- If user-input: add two fields to public form payload and validation.
- If internal-only: no code changes needed, just fill data from admin/database workflow when copy is delivered.
