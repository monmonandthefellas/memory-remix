# Memory Remix - Admin Setup

## 1. Purpose

This guide explains how to set up and operate the private Admin panel and backend API.

Admin URLs:
- `/admin-login`
- `/admin`
- `/dashboard` (alias to admin)

## 2. Required Environment Variables

Set these variables in local `.env.local` and in Vercel Project Settings.

Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Backend:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL_ALLOWLIST`

`ADMIN_EMAIL_ALLOWLIST` format:
```txt
admin1@site.com,admin2@site.com
```

Notes:
- `SUPABASE_URL` should match `VITE_SUPABASE_URL`.
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in frontend code.
- Emails in allowlist should be lowercase.

## 3. Create Admin Account in Supabase

1. Open Supabase project dashboard.
2. Go to `Authentication -> Users`.
3. Create or invite the admin user (email/password or invite flow).
4. Add the same email to `ADMIN_EMAIL_ALLOWLIST`.
5. Re-deploy Vercel (or restart `vercel dev`) after env changes.

## 4. Local Run (Full Stack)

Use Vercel dev server so `/api/*` routes are available.

```bash
npm install
npx vercel dev
```

Open:
- `http://localhost:3000/admin-login`

Do not use only `npm run dev` for admin API testing. Vite on `:5173` does not run Vercel serverless routes.

## 5. Admin API Endpoints

Auth header for all endpoints:
```http
Authorization: Bearer <supabase_access_token>
```

1. `GET /api/admin/submissions`
- Query:
  - `status=all|pending|approved|rejected` (default `all`)
  - `limit=1..200` (default `50`)
  - `offset>=0` (default `0`)
- Response:
```json
{
  "data": [],
  "pagination": { "limit": 50, "offset": 0, "count": 0 },
  "filter": { "status": "all" }
}
```

2. `GET /api/admin/submissions/:id`
- Response:
```json
{ "data": { "id": "uuid", "status": "pending" } }
```

3. `PATCH /api/admin/submissions/:id`
- Body:
```json
{ "status": "approved" }
```
or
```json
{ "status": "rejected" }
```
- Response:
```json
{
  "data": { "id": "uuid", "status": "approved" },
  "message": "status_updated"
}
```

## 6. Quick Smoke Test

1. Login at `/admin-login` with a Supabase user from allowlist.
2. Open `/admin` and load submissions.
3. Open one submission detail.
4. Verify audio playback works if `audio_url` is valid.
5. Click `Approve` or `Reject`.
6. Refresh list and confirm status changed.

## 7. Common Errors

1. `500 server_misconfigured` + `Missing required environment variable: SUPABASE_URL`
- `SUPABASE_URL` is missing in Vercel/local runtime.
- Add env var and restart server/deploy.

2. `401 unauthorized`
- Missing/expired bearer token.
- Re-login in admin.

3. `403 forbidden`
- User is authenticated but email is not in `ADMIN_EMAIL_ALLOWLIST`.

4. Empty admin list with known records
- Check record status filter and RLS migration status.
- Confirm data exists in `public.memories`.
