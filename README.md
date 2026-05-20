# Cayworks Display Manager

**OptiSigns Client Playlist Portal** — a secure middle layer that lets clients
manage the playlists shown on their OptiSigns screens without ever seeing the
OptiSigns API key.

## What it does

- Clients log in, view the playlists & screens assigned to them, edit content
  (add / remove assets, change durations, reorder), and submit changes.
- Admins approve drafts (or auto-publish, depending on the client setting),
  and the server pushes the changes to OptiSigns over GraphQL.
- Every action is audit-logged.
- The OptiSigns API key lives in `OPTISIGNS_API_KEY` and is **only** used
  server-side — it is never sent to the browser.

## Stack

- **Next.js 14** (App Router, server components, API routes)
- **TypeScript** + **Tailwind CSS**
- **Prisma** (SQLite by default, swap to Postgres for production)
- **JWT-cookie session auth** (`AUTH_SECRET`)
- **Netlify-friendly** — `netlify.toml` included with the Next.js plugin.

## Getting started — Netlify + Neon (zero manual steps)

1. **In Netlify**, set these environment variables (Site → Environment):

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon Postgres connection string |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `OPTISIGNS_API_KEY` | Your OptiSigns API key |
   | `OPTISIGNS_GRAPHQL_ENDPOINT` | `https://graphql-gateway.optisigns.com/graphql` |
   | `SUPER_ADMIN_EMAIL` | Your login email |
   | `SUPERADMIN_MASTER_KEY` | Your login password (min 12 chars) |

2. **Deploy.** The Netlify build runs `prisma db push` automatically and
   creates every table on Neon.

3. **Visit your site and click "Sign in".** The first time `/login` renders,
   the app checks whether a `SUPERADMIN` exists; if not, it hashes
   `SUPERADMIN_MASTER_KEY` with bcrypt and provisions the account from
   `SUPER_ADMIN_EMAIL`. Subsequent renders are no-ops.

4. **Sign in** with `SUPER_ADMIN_EMAIL` + `SUPERADMIN_MASTER_KEY` (the
   plaintext value, not the hash). From there, create clients, mappings, and
   assets in the admin UI.

That's it — no bcrypt CLI, no SQL editor, no `prisma db push` from your
laptop.

### Rotating the master key

The auto-bootstrap only creates the superadmin when none exists. To change
the password later: sign in, update your own user via a SQL one-liner, or
delete the row in the Neon SQL editor and redeploy (the next `/login` render
will recreate it from the env var).

### Local development (optional)

```bash
cp .env.example .env
# point DATABASE_URL at a local or Neon dev branch
npm install
npm run dev   # build target runs prisma db push for you
```

The seed script (`SEED_DEMO_DATA=true npm run db:seed`) is still available
for loading the Acme demo client + two demo users (password `ChangeMe123!`,
roles `CLIENT_OWNER` / `CLIENT_EDITOR`).

## Connecting to OptiSigns

1. Get an API key from your OptiSigns account (Settings → API).
2. Set the following Netlify (or local `.env`) variables:

   ```
   OPTISIGNS_API_KEY=<your real key>
   OPTISIGNS_GRAPHQL_ENDPOINT=https://graphql-gateway.optisigns.com/graphql
   ```

3. Inside the admin UI:
   - Create a **client**.
   - On **OptiSigns Mappings**, link that client to one or more OptiSigns
     playlist IDs (and optionally screen/device IDs).
   - On **Assets**, add `AssetReference` rows for each OptiSigns asset the
     client may use. `optisignsAssetId` must match the real OptiSigns ID.
4. Client users can now log in and manage their playlists.

### ⚠️ Schema confirmation required before going live

The GraphQL documents in `src/lib/optisigns/` use the *names* documented by
OptiSigns (`savePlaylist`, `addPlaylistItems`, `updatePlaylistItems`,
`removePlaylistItems`, `updateDevice`) but the exact input shapes can vary by
account. Before publishing real traffic:

1. Run an introspection against `https://graphql-gateway.optisigns.com/graphql`
   with your bearer token.
2. Verify each mutation's `*Input` types match the variables we send in
   `src/lib/optisigns/playlists.ts`, `devices.ts`, `assets.ts`.
3. Adjust the GraphQL strings if needed — the function signatures are stable,
   so nothing else in the codebase needs to change.

## Project layout

```
prisma/
  schema.prisma            Database models
  seed.ts                  Demo data
src/
  app/
    login/                 Login page
    (app)/                 Authenticated app (sidebar layout)
      dashboard/           Client dashboard
      playlists/           My Playlists list + editor
      assets/              Asset library
      activity/            Per-client audit
      admin/               Admin views (clients, mappings, approvals, …)
    api/
      auth/                Login / logout
      playlists/[id]/      Draft save, submit, item ops
      admin/               Admin-only routes
      assets/              Per-client asset listing
  lib/
    auth.ts                JWT session + password hashing
    prisma.ts              Prisma client singleton
    rbac.ts                Role / client-isolation enforcement
    audit.ts               Audit log helper
    publish.ts             Draft → OptiSigns sync logic
    optisigns/
      client.ts            Low-level GraphQL fetch (server only)
      playlists.ts         Playlist mutations / queries
      devices.ts           updateDevice (assign playlist to screen)
      assets.ts            Asset queries + saveWebsiteAsset
  components/
    Sidebar.tsx            Role-aware sidebar
    ui.tsx                 PageHeader, Card, Badge, etc.
  middleware.ts            Redirects unauthenticated users to /login
```

## Production deployment (Netlify)

1. Push this repo to GitHub.
2. Connect the repo on Netlify. The included `netlify.toml` uses the
   `@netlify/plugin-nextjs` build plugin.
3. In Netlify environment variables, set:
   - `OPTISIGNS_API_KEY`
   - `OPTISIGNS_GRAPHQL_ENDPOINT`
   - `AUTH_SECRET` (`openssl rand -base64 32`)
   - `DATABASE_URL` (Netlify DB / Neon / Supabase Postgres URL)
4. Update `prisma/schema.prisma` to use `provider = "postgresql"` if you switch
   from SQLite, then run `npx prisma migrate deploy`.
5. Re-seed if desired: `npm run db:seed`.

## Security guarantees

- The OptiSigns API key is read only on the server in
  `src/lib/optisigns/client.ts` and is **never** included in any response or
  client bundle.
- All `/api/admin/*` routes require `SUPERADMIN` or `ADMIN`.
- All client-scoped routes call `requireClientAccess(clientId)` — a non-admin
  user cannot read or modify another client's data.
- Asset references are validated server-side: a client cannot inject an asset
  ID that isn't approved for their account.
- All state-changing endpoints write to `AuditLog`.
- Passwords are hashed with bcrypt (cost 10).
- Sessions are signed JWTs stored as `HttpOnly` cookies (`SameSite=lax`,
  `Secure` in production).

## MVP scope & next steps

Implemented in this MVP:

- Auth + RBAC + audit logging
- Client and admin UIs
- Playlist draft editor (add, remove, reorder, edit duration)
- Submit → admin approval queue → publish to OptiSigns
- Auto-publish when client is configured for it and `canPublishDirectly` is true
- OptiSigns GraphQL service layer (playlists, devices, assets)
- Netlify-ready deployment config

Deferred (clear extension points exist):

- Direct file upload of images/videos to OptiSigns (REST `/v1/assets`
  multipart endpoint is the likely path — see `src/lib/optisigns/assets.ts`).
- Drag-and-drop reorder (the editor uses ↑/↓ buttons today for accessibility
  and minimal dependencies; swap in `@dnd-kit` if desired).
- Email invitations / password reset.
- 2FA.
- Bulk import of OptiSigns playlists & assets via introspection.
