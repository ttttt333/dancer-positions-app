---
name: dancer-positions-security-audit
description: >-
  Audits the dancer-positions-app (ChoreoGrid / 立ち位置アプリ) for security
  vulnerabilities across Supabase RLS, Express API, Vercel serverless, auth,
  storage, billing, and share links. Use when the user requests a security
  review, penetration-style check, or hardening guidance for this project.
---

# Dancer Positions App — Security Audit

## Scope

Audit `/Users/sopsakai/Documents/dancer-positions-app` with focus on:

| Layer | Key paths |
|-------|-----------|
| Supabase | `supabase/schema.sql`, `supabase/share-view-audio-policy.sql`, `supabase/fix-*.sql` |
| Express API | `server/index.mjs`, `server/parse*.mjs` |
| Vercel API | `api/parse-position.js`, `api/parse-roster-names.js` |
| Client auth | `src/context/AuthContext.tsx`, `src/lib/supabaseClient.ts`, `src/api/client.ts` |
| Storage / share | `src/lib/supabaseAudio.ts`, `src/lib/shareView*.ts` |
| Config | `vercel.json`, `.env.example`, `vite.config.ts` |
| Billing | Stripe webhook + checkout in `server/index.mjs` |

The app has **two backends**: Supabase (production) and legacy Express+SQLite (local/dev). Check both paths.

## Audit workflow

Copy and track:

```
Security audit progress:
- [ ] 1. Map attack surface (public vs auth endpoints)
- [ ] 2. Auth & session (JWT, Supabase, demo token)
- [ ] 3. Authorization (IDOR, RLS, project/collaborator access)
- [ ] 4. Secrets & env exposure (VITE_*, OPENAI, Stripe)
- [ ] 5. Storage & share tokens (audio leakage, enumeration)
- [ ] 6. API abuse (rate limit, CORS, unauthenticated AI routes)
- [ ] 7. WebSocket / Yjs collab
- [ ] 8. Input validation & injection
- [ ] 9. Client-side (XSS, localStorage tokens, CSP/COEP)
- [ ] 10. Billing integrity
- [ ] 11. Dependencies & deployment headers
```

### Step 1 — Attack surface

Enumerate every route that accepts unauthenticated traffic:

- `GET /api/public/membership-approve` (token in query)
- `POST /api/billing/webhook`
- `POST /api/parse-position`, `POST /api/parse-roster-names` (Vercel + Express)
- Supabase RPC `get_project_by_share_token`
- Share view `/view/s/{token}` and anon Storage policy
- WebSocket upgrade with JWT query param

### Step 2 — Auth checklist

- Default `JWT_SECRET` fallback in production
- JWT expiry (30d), no refresh/revocation
- Password policy (min 6 chars)
- `DEMO_SESSION_TOKEN` bypass behavior
- Supabase anon key exposure (expected) vs service role (must not be in client)
- Google OAuth redirect URL config

### Step 3 — Authorization checklist

- `canAccessProject` / `isProjectOwner` on all project/audio/collab routes
- Supabase RLS: `choreocore_projects` CRUD scoped to `auth.uid()`
- Share RPC: only returns rows matching token; no over-fetch
- Storage: own-path RLS + shared-view policy — can anon read **any** audio whose path appears in **any** shared project's JSON?
- Membership approve without admin identity (`decidedBy: null` on public endpoint)
- `GET /api/organizations` — any authenticated user lists all orgs?
- Collaborator add by email — enumeration?

### Step 4 — Secrets

- `OPENAI_API_KEY` must never be `VITE_*`
- Grep for hardcoded keys, `sk-`, `service_role`
- `.env` / `.gitignore` coverage

### Step 5 — Share & storage

- `share_token` entropy and uniqueness
- Audio path in JSON: predictable UUID paths vs path guessing
- Signed URL expiry for editor playback
- `share-view-audio-policy.sql`: cross-project audio leak if two projects reference same path

### Step 6 — API abuse

- Unauthenticated OpenAI proxy on Vercel (`Access-Control-Allow-Origin: *`) — cost abuse
- `express.json({ limit: "20mb" })` — DoS
- Multer 80MB upload without auth on peaks route? (check auth middleware)
- No rate limiting anywhere?

### Step 7 — WebSocket

- JWT in URL (logs, referrer leakage)
- `canAccessProject` enforced on upgrade
- Yjs doc init loads project JSON without re-check on every message?

### Step 8 — Input

- SQL: parameterized queries (better-sqlite3)
- JSON project blob size limits
- Image base64 size limits on parse routes
- `dangerouslySetInnerHTML` in React

### Step 9 — Client

- Token in `localStorage`
- COEP/COOP headers in `vercel.json`
- Third-party scripts

### Step 10 — Billing

- Webhook signature verification
- `verify-session` binds `client_reference_id` to user
- `placeholder-purchase` — dev-only exposure risk in production

## Severity rubric

| Level | Meaning |
|-------|---------|
| **Critical** | Exploitable now; data breach, auth bypass, or financial loss |
| **High** | Serious flaw; needs fix before production |
| **Medium** | Defense-in-depth gap or abuse vector with mitigations |
| **Low** | Hardening, best practice |
| **Info** | Observation, accepted risk |

## Report template

```markdown
# Security Audit — dancer-positions-app

**Date:** YYYY-MM-DD
**Scope:** [Supabase / Express / Vercel / client]

## Executive summary
[2–4 sentences: overall posture, top risks]

## Findings

### [SEV-001] Title
- **Severity:** Critical | High | Medium | Low | Info
- **Location:** `path:line` or policy name
- **Description:** What is wrong and why it matters
- **Evidence:** Code snippet or policy excerpt
- **Recommendation:** Concrete fix
- **Effort:** S | M | L

(repeat per finding)

## Positive controls
- [What is done well]

## Prioritized remediation
1. ...
2. ...

## Out of scope / not verified
- [e.g. live Supabase dashboard, production env values]
```

## Commands to run

```bash
# Secrets in repo
rg -i "(sk-[a-zA-Z0-9]{10,}|service_role|JWT_SECRET\s*=\s*['\"][^'\"]+['\"])" --glob '!node_modules' --glob '!package-lock.json'

# Dangerous patterns
rg "dangerouslySetInnerHTML|eval\(|innerHTML\s*=" src/

# Public API routes without auth
rg "app\.(get|post|put|delete)\(" server/index.mjs

# VITE_ secrets (should only be public config)
rg "VITE_.*KEY|VITE_.*SECRET" .
```

Read referenced files before claiming a finding. Cite `path:line` for every issue.
