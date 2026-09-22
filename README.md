# Pixel & Ping — Infrastructure Panel

A real, production-ready infrastructure and network management panel: managed users, servers,
endpoints, ports, real configuration builders (VLESS / VMess / Trojan / Shadowsocks), live TCP/TLS
health checks, traffic ingestion, analytics, failover rules, audit logs,
API keys and role-based access — backed by PostgreSQL. Deployed on Railway.

**No fake data.** Every number on the dashboard comes from a database query. A fresh install
shows `0` everywhere and walks you through first-run setup.

---

## Stack

| Layer      | Technology                                       |
| ---------- | ------------------------------------------------ |
| Framework  | Next.js 16 (App Router) + TypeScript strict       |
| UI         | Tailwind CSS 4, Framer Motion, Lucide icons       |
| API        | Next.js Route Handlers (REST, JSON envelopes)     |
| Database   | PostgreSQL                                        |
| ORM        | Prisma (migrations included)                      |
| Auth       | DB-backed sessions, HttpOnly cookies, scrypt hashes |
| Validation | Zod on every write endpoint                       |
| Tests      | Vitest                                            |

### Project layout

```
prisma/                  # schema + SQL migrations
src/app/                 # frontend pages (App Router)
src/app/api/             # backend REST API (route handlers)
src/components/          # design system + app shell components
src/lib/                 # auth, rbac, crypto, validation, services (business logic)
src/lib/services/        # health checks, providers, scanner, stats, jobs
tests/                   # vitest unit tests
```

---

## Deploy to Railway (beginner-friendly, step by step)

1. **Create the project.** Go to [railway.app](https://railway.app) → *New Project* →
   *Deploy from GitHub repo* and pick this repository (fork or push it to your account first).

2. **Add PostgreSQL.** Inside the same project click *+ New* → *Database* → *Add PostgreSQL*.
   Railway creates a database service and exposes a `DATABASE_URL` variable.

3. **Link the variable to your app.** Open your app service → *Variables* → add a variable
   reference: name it `DATABASE_URL` and select the `DATABASE_URL` exposed by Postgres.

4. **Add your secrets.** Still in *Variables*, add:

   | Variable         | How to generate                                      |
   | ---------------- | ---------------------------------------------------- |
   | `SESSION_SECRET` | run `openssl rand -hex 32` locally and paste output   |
   | `ENCRYPTION_KEY` | run `openssl rand -hex 32` again (different value)    |

   Optional: `SETUP_TOKEN` (extra-admin bootstrap token), `CORS_ORIGIN`.

5. **Deploy.** Railway detects the Next.js app (see `railway.json`). Build runs
   `prisma generate && next build`; on start it runs `prisma migrate deploy` automatically
   and listens on `$PORT`.

6. **Open your domain.** In the app service → *Settings* → *Networking* → *Generate Domain*.

7. **Verify health.** Visit `https://<your-domain>/health` — you should see `{"ok":true}`.

8. **Create the first admin.** Open `https://<your-domain>/setup`. Because the database has no
   users yet, setup is open. Create your administrator — credentials are never hardcoded.
   After bootstrap, `/setup` requires the `SETUP_TOKEN` environment variable.

9. **Done.** Sign in at `/login` and start adding servers and users.

### First deployment checklist

- [ ] `/health` returns `{"ok":true}`
- [ ] `/setup` created your admin and redirected to the dashboard
- [ ] Dashboard shows real zeros (no users/servers yet)
- [ ] Add a server → press **Test connection** → the status reflects a **real TCP probe**

---

## Local development

Requirements: Node 20+, PostgreSQL (any locally running instance).

```bash
cp .env.example .env          # then edit DATABASE_URL + secrets
npm install
npm run db:push               # or: npm run db:migrate:dev
npm run dev                   # http://localhost:3000
```

Open `http://localhost:3000/setup` to create the first admin.

### Scripts

| Command              | What it does                                  |
| -------------------- | --------------------------------------------- |
| `npm run dev`        | Development server (port 3000)                |
| `npm run build`      | Production build (standalone output)          |
| `npm run start`      | Run the production server (respects `$PORT`)  |
| `npm run lint`       | ESLint                                        |
| `npm test`           | Vitest unit tests                             |
| `npm run db:migrate` | Apply migrations (`prisma migrate deploy`)    |
| `npm run db:push`    | Sync schema without migration files (dev only)|

---

## API overview

All responses use a consistent envelope:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…" } }
```

### Auth & accounts
- `POST /api/auth/login` — email/username + password (rate limited, audit logged)
- `POST /api/auth/logout`
- `POST /api/auth/password` — change own password
- `GET /api/me` — session user + unread notification count
- `PATCH /api/me` — profile + preferences (locale, reduced motion)
- `GET|POST /api/setup` — first-admin bootstrap

### Panel data
- `GET /api/dashboard` — real aggregate stats + health
- `GET /api/system/health` — database/API/jobs report
- `GET|POST /api/users`, `GET|PATCH|DELETE /api/users/:id`
- `GET|POST /api/users/:id/config` — fetch / regenerate the proxy config
- `GET|POST /api/servers`, `PATCH|DELETE /api/servers/:id`, `POST /api/servers/:id/test`, `POST /api/servers/test-all`
- `GET|POST /api/endpoints`, `PATCH|DELETE /api/endpoints/:id`, `POST /api/endpoints/:id/test`
- `GET|POST /api/ports`, `PATCH|DELETE /api/ports/:id`, `POST /api/ports/:id/test`
- `GET|POST /api/configs`, `DELETE /api/configs/:id`, `GET /api/configs/providers`
- `POST /api/scanner` — controlled DNS/TCP/HTTP diagnostics (rate limited)
- `GET /api/traffic?range=24h|7d|30d|all`
- `GET /api/analytics?range=…`
- `GET /api/logs` — searchable, filterable, paginated
- `GET|PATCH /api/notifications`, `POST /api/notifications/read-all`
- `GET|PUT /api/settings`, `POST /api/settings/purge` (admin)
- `GET|POST /api/api-keys`, `DELETE /api/api-keys/:id` (revoke)
- `GET|POST /api/failover`, `PATCH|DELETE /api/failover/:id`, `POST /api/failover/:id/check`
- `GET /api/search?q=` — command-palette search
- `GET /health` — Railway healthcheck, returns `{"ok":true}`

### Traffic ingest (for real data planes)

Push usage records from an exporter/proxy API using an API key with the
`traffic:ingest` permission (create keys under **API Keys** in the panel):

```bash
curl -X POST https://<your-domain>/api/traffic/ingest \
  -H "Authorization: Bearer ppk_…" \
  -H "Content-Type: application/json" \
  -d '{"records":[{"vpnUserId":"…","bytesIn":1048576,"bytesOut":4194304,"requests":42}]}'
```

Traffic and analytics pages stay empty until real records exist — by design.

---

## Roles

| Role     | Capabilities                                                                 |
| -------- | ---------------------------------------------------------------------------- |
| ADMIN    | Everything, including settings, API keys, audit logs, danger zone |
| OPERATOR | Manage users/servers/endpoints/ports/configs/scanner/failover                 |
| VIEWER   | Read-only dashboards and lists                                                |

Permission checks run on the backend (`src/lib/rbac.ts` + route guards). The UI only mirrors them.

## Security notes

- Passwords: scrypt with per-user salts, constant-time verification.
- Sessions: 256-bit random tokens, only SHA-256 hashes stored; HttpOnly + SameSite cookies;
  `Secure` in production; DB-side expiry + cleanup job.
- CSRF: mutating API requests require same-origin; cookies are SameSite=Lax.
- API keys: stored as SHA-256 hashes; the full secret is displayed exactly once.
- Rate limiting: login (per-IP + per-identifier), scanner, health tests, ingest, general API.
- Structured logging with automatic secret redaction. No stack traces reach clients.
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Background jobs

A single 60s scheduler (started from `instrumentation.ts`) performs:
health checks (configurable interval), expiry scans + expiry alert notifications,
session cleanup, failover rule evaluation. Intervals are bounded and state is persisted,
so restarts never duplicate work. The dashboard reports job freshness honestly
(`Healthy / Degraded / Not configured`).
