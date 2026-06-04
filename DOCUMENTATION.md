# Nightingale Recruit — Full Project Documentation

> Healthcare Recruitment Outreach **Automation** System for USA healthcare professionals.
>
> This document explains the entire project end-to-end: the technology stack, every feature,
> how data is fetched and managed, how automation works, what tools are used, and the
> difference between Admin and Recruiter roles.

---

## Table of Contents

1. [What this product does](#1-what-this-product-does)
2. [Technology stack](#2-technology-stack)
3. [High-level architecture](#3-high-level-architecture)
4. [Roles & access control (RBAC)](#4-roles--access-control-rbac)
5. [Pages & features](#5-pages--features)
6. [Data model (Firestore collections)](#6-data-model-firestore-collections)
7. [Authentication](#7-authentication)
8. [Candidate sourcing & enrichment (Apollo / PDL / Sandbox)](#8-candidate-sourcing--enrichment-apollo--pdl--sandbox)
9. [Email system (send, tracking, replies, unsubscribe)](#9-email-system)
10. [Automation engine (follow-up sequences)](#10-automation-engine-follow-up-sequences)
11. [Auto-sourcing (scheduled candidate discovery)](#11-auto-sourcing-scheduled-candidate-discovery)
12. [Auto-assignment (round-robin)](#12-auto-assignment-round-robin)
13. [Cron jobs & scheduling](#13-cron-jobs--scheduling)
14. [SMS (Twilio)](#14-sms-twilio)
15. [AI assist](#15-ai-assist)
16. [Notifications, tasks, saved views](#16-notifications-tasks-saved-views)
17. [Security model](#17-security-model)
18. [Environment variables](#18-environment-variables)
19. [Setup & running locally](#19-setup--running-locally)
20. [API reference](#20-api-reference)
21. [Project structure](#21-project-structure)
22. [Known limitations & edge cases](#22-known-limitations--edge-cases)

---

## 1. What this product does

Nightingale Recruit is a **CRM with built-in outreach automation** aimed at recruiting USA
healthcare professionals (Registered Nurses, NPs, PAs, therapists, etc.).

The core loop is:

1. **Source** candidates from external providers (Apollo.io or People Data Labs) or CSV/manual entry.
2. **Store & manage** them in Firestore with a recruiting pipeline (New Lead → Contacted → Replied → Interested → Interview Scheduled → Closed).
3. **Reach out** via templated email (and optionally SMS).
4. **Automate follow-ups** on a Day 1 / 3 / 7 / 14 cadence that auto-stops when a candidate replies or unsubscribes.
5. **Track engagement** (opens, clicks, replies) and surface analytics.

---

## 2. Technology stack

| Layer | Technology |
|-------|-----------|
| Framework | **Next.js 16** (App Router) on **React 19** |
| Language | **TypeScript 5** |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (built on **Base UI** / Radix primitives) |
| UI extras | **Framer Motion** (animations), **lucide-react** (icons), **Recharts** (charts), **TanStack Table** (data tables), **cmdk** (command palette), **sonner** (toasts), **next-themes** (dark mode), **@dnd-kit** (pipeline drag-and-drop) |
| Forms & validation | **React Hook Form** + **Zod** |
| Backend / data | **Firebase** — Auth, **Firestore**, Storage (client SDK in browser; **firebase-admin** SDK in API routes) |
| Email | **Nodemailer** (SMTP) |
| External data | **Apollo.io** API and **People Data Labs (PDL)** API |
| SMS (optional) | **Twilio** REST API |
| AI (optional) | **OpenAI** (with template fallback) |
| CSV | **papaparse** |
| Hosting / cron | **Vercel** (cron jobs via `vercel.json`) |
| Dev tooling | ESLint 9, tsx (seed script), dotenv |

Scripts (`package.json`):

```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm run seed     # Seed admin/recruiter users + default settings (NOT candidates)
```

---

## 3. High-level architecture

The app uses a **hybrid data access** pattern:

- **Browser → Firestore directly** for most reads/writes, via the client SDK in `src/lib/services/*`. These are constrained by Firestore security rules.
- **Browser → Next.js API routes → Admin SDK** for sensitive side effects (sending email, inbound webhooks, tracking pixels, Twilio, provider imports, recruiter creation). API routes authenticate the caller with a Firebase ID token (`verifyAuthToken`).

```mermaid
flowchart TB
  subgraph client [Browser - Firebase Client SDK]
    Pages[Dashboard Pages]
    Services[src/lib/services/*]
    AuthCtx[AuthContext]
    Pages --> Services --> Firestore[(Firestore)]
    AuthCtx --> FirebaseAuth[Firebase Auth]
  end

  subgraph server [Next.js API Routes - Firebase Admin SDK]
    EmailAPI[/api/email/*]
    TrackAPI[/api/track/*]
    ApolloAPI[/api/apollo/*]
    AutoAPI[/api/automation/*]
    SrcAPI[/api/sourcing/*]
    EmailAPI --> AdminDB[(Firestore Admin)]
  end

  Pages -->|apiFetch + Bearer ID token| EmailAPI
  Pages --> ApolloAPI
  EmailAPI --> SMTP[Nodemailer SMTP]
  ApolloAPI --> Providers[Apollo.io / PDL]
  Vercel[Vercel Cron] --> AutoAPI
  Vercel --> SrcAPI
```

---

## 4. Roles & access control (RBAC)

There are two roles (`src/types/index.ts`): **`admin`** and **`recruiter`**. Users also have a
`status` of `active` or `inactive` — inactive users are blocked from the app entirely.

Access is enforced in **three layers**:

1. **Route guard** — `canAccessRoute()` (`src/lib/rbac.ts`) blocks recruiters from admin routes and `DashboardShell` redirects them to `/dashboard`.
2. **Navigation filtering** — `getNavForRole()` (`src/components/layout/nav-config.ts`) hides nav items the role can't use.
3. **Data scoping** — pages and Firestore rules further restrict recruiters to their **assigned** candidates.

**Admin-only routes** (`ADMIN_ROUTES`): `/recruiters`, `/analytics`, `/activity`, `/settings`, `/sourcing`.

| Capability | Admin | Recruiter |
|-----------|:-----:|:---------:|
| Dashboard | Org-wide | Own assigned data |
| Find Prospects (sourcing search) | ✅ | ✅ |
| Candidates | All candidates | Only assigned ("My Candidates") |
| Pipeline (Kanban) | All | Own assigned |
| Outreach (templates + send) | ✅ | ✅ |
| Followups | All | Own |
| Notes | (via candidate) | ✅ (timeline) |
| Profile (+ test email) | (header dialog) | ✅ page |
| Analytics | ✅ | ❌ |
| Activity Logs | ✅ | ❌ |
| Recruiters management | ✅ | ❌ |
| Auto-Sourcing rules | ✅ | ❌ |
| Settings (SMTP, automation) | ✅ | ❌ |

---

## 5. Pages & features

All dashboard pages live under `src/app/(dashboard)/`.

| Page | Route | What it does | Access |
|------|-------|--------------|--------|
| **Dashboard** | `/dashboard` | Role-aware home: stat cards (candidates, outreach, response/open/click rates), candidates-by-role chart, tasks-due-today widget, today's follow-ups. Admin sees org-wide + recent activity; recruiter sees only their data. | Both |
| **Find Prospects** | `/prospects` | Search Apollo/PDL/sandbox for people, auto-save (PDL) or enrich + import to CRM. City/state filters, masked-contact handling, credit indicator. | Both |
| **Auto-Sourcing** | `/sourcing` | Define saved-search rules (titles, locations, per-run cap, auto-enroll, assigned recruiter); run a single rule or all enabled. | Admin |
| **Candidates / My Candidates** | `/candidates` | Candidate table: search, filters, CRUD, CSV import/export, saved views, bulk assign/delete. Admin: duplicate finder/merge. | Both (scoped) |
| **Candidate detail** | `/candidates/[id]` | Full candidate hub with tabs: Overview, Conversation (messages), Notes, Activity, Outreach history, Followups. Actions: change status, enrich contact, enroll sequence, AI draft/summary, send outreach, schedule interview. | Both (data-scoped) |
| **Pipeline** | `/pipeline` | Kanban board by status; drag-and-drop to change a candidate's stage. | Both (scoped) |
| **Outreach** | `/outreach` | Email template builder (with variables + preview); send an email to **one or many candidates at once** (multi-select). | Both |
| **Followups** | `/followups` | Visualizes the Day 1/3/7/14 sequence; lists scheduled vs sent; "Run Automation Now" button. | Both (scoped) |
| **Notes** | `/notes` | Read-only timeline of notes you authored, each linking back to the candidate. | Recruiter nav |
| **Analytics** | `/analytics` | Org performance: candidates by role/state, response & engagement trends, recruiter performance chart + leaderboard. | Admin |
| **Activity** | `/activity` | System audit trail (user, action, entity, timestamp). | Admin |
| **Recruiters** | `/recruiters` | Create/activate/deactivate/delete recruiters, upload avatars, bulk-assign candidates to a recruiter. | Admin |
| **Settings** | `/settings` | Company branding, from-email, default template, SMTP config, automation toggles. | Admin |
| **Profile** | `/profile` | Change password; **send a test email** to verify SMTP. | Recruiter page (admins use the header "My Profile" dialog) |

Cross-cutting UI features:

- **Command palette** (`Cmd/Ctrl+K`) — jump to pages, search candidates, quick actions.
- **Notification bell** — live Firestore notifications (replies, assignments, follow-ups sent).
- **Dark mode** — header toggle (next-themes).
- **CSV import wizard** — column mapping + duplicate preview.

---

## 6. Data model (Firestore collections)

Collection names are centralized in `src/lib/constants.ts` (`COLLECTIONS`). Settings is a
singleton document with ID `app`.

| Collection | Purpose | Key fields |
|-----------|---------|-----------|
| `users` | App users (admin/recruiter) | `email`, `name`, `role`, `status`, `avatarUrl` |
| `candidates` | Recruiting prospects | `fullName`, `role`, `email`, `phone`, `location`, `city`, `state`, `linkedinUrl`, `experience`, `currentEmployer`, `certification`, `emailAvailable`, `phoneAvailable`, `status`, `assignedRecruiterId/Name`, `tags[]`, `apolloId`, `source`, `optedOut`, `emailBounced` |
| `outreachs` | Sent emails/SMS + engagement | `candidateId`, `recruiterId`, `subject`, `body`, `channel`, `status`, `opens`, `clicks`, `openedAt`, `firstClickAt`, `repliedAt`, `sentAt` |
| `followups` | Scheduled sequence steps | `candidateId`, `recruiterId`, `sequenceStep` (day_1/3/7/14), `scheduledFor`, `status` (scheduled/sent/skipped/stopped), `subject`, `body` |
| `messages` | Conversation thread | `candidateId`, `direction` (inbound/outbound), `subject`, `body`, `outreachId` |
| `notes` | Manual candidate notes | `candidateId`, `authorId/Name`, `body` |
| `templates` | Email templates | `name`, `subject`, `body`, `createdBy` |
| `activities` | Audit log | `userId/Name`, `action`, `entityType`, `entityId`, `timestamp` |
| `notifications` | In-app notifications | `userId`, `type`, `title`, `body`, `read` |
| `tasks` | To-dos | `userId`, `title`, `candidateId`, `dueAt`, `status` |
| `savedViews` | Saved candidate filters | `userId`, `name`, `filters` |
| `sourcingRules` | Auto-sourcing definitions | `personTitles[]`, `locations[]`, `perRun`, `enabled`, `autoEnroll`, `assignedRecruiterId/Name`, run stats |
| `settings` | App config (doc `app`) | `companyName`, `fromEmail`, `smtp`, `defaultTemplateId`, `automation` |

**Composite indexes** (`firestore.indexes.json`): `notifications (userId, createdAt desc)`,
`tasks (userId, dueAt asc)`, `savedViews (userId, createdAt desc)`, `messages (candidateId, createdAt asc)`.

---

## 7. Authentication

- **Provider:** Firebase Auth (Email/Password).
- **Login** (`/login`): Zod-validated form → `signInWithEmailAndPassword` → redirect to `/dashboard`.
- **Auth context** (`src/context/auth-context.tsx`): subscribes to `onAuthStateChanged`, loads the Firestore `users/{uid}` profile, exposes `firebaseUser`, `profile`, `role`, `loading`, `refreshProfile`.
- **API auth:** `src/lib/api-client.ts#apiFetch` attaches the Firebase ID token as `Authorization: Bearer <token>`. Server routes validate it with `verifyAuthToken` (`src/lib/auth/server.ts`) and load the role; `requireAdmin` guards admin-only endpoints.

> Recruiter accounts are **created by an admin** on the Recruiters page (via `/api/recruiters`,
> Admin SDK), not via public sign-up.

---

## 8. Candidate sourcing & enrichment (Apollo / PDL / Sandbox)

This subsystem lives under `src/lib/apollo/` (the "apollo" naming is historical — it now
abstracts multiple providers) and is exposed via `src/app/api/apollo/*` and the **Find Prospects** page.

### Supported providers

| Provider | Module | When used |
|----------|--------|-----------|
| **Sandbox** | `sandbox.ts` | `APOLLO_SANDBOX=true` — built-in sample healthcare profiles, no API/credits needed |
| **People Data Labs (PDL)** | `pdl.ts` | `DATA_PROVIDER=pdl` + `PDL_API_KEY`, or auto when only a PDL key is present |
| **Apollo.io** | `client.ts` | Default when an Apollo key is present and PDL isn't selected |

### Provider selection (`getActiveProvider`)

Resolution order:

1. `DATA_PROVIDER=pdl` **and** PDL key set → **pdl**
2. `DATA_PROVIDER=apollo` **and** Apollo key set → **apollo**
3. `APOLLO_SANDBOX=true` → **sandbox**
4. `DATA_PROVIDER` explicit (even without key) → that provider
5. PDL key set and no Apollo key → **pdl**
6. Otherwise → **apollo**

### How search works

- **Apollo:** `POST /mixed_people/api_search` — returns **previews only** (obfuscated last name, `hasEmail`/`hasPhone` flags). Enrichment is a separate, credit-costing step.
- **PDL:** `POST /v5/person/search` with an Elasticsearch-style query built from titles, locations, and optional employer domains. Crucially, PDL search returns **full profiles**, which are mapped and returned as `result.enriched` and cached in-process so the UI can **auto-save without a second enrich call**.
- **Sandbox:** filters six fixed sample profiles by title/location.

Locations are formatted by `format-location.ts` (e.g. `"Houston, Texas, US"`). The UI exposes
state and city dropdowns (`CITIES_BY_STATE` in `constants.ts`) with "All" sentinels.

### How enrichment works

- **Apollo:** `POST /people/bulk_match` (max 10 IDs) or single `POST /people/match` by LinkedIn URL, email, or name+company.
- **PDL:** enrich is served from the **search-time cache** when possible (no extra credits); on a cache miss it calls `POST /person/enrich` by `pdl_id`. Lookups by LinkedIn/email/name use `min_likelihood: 2`.
- **Re-enrich an existing candidate:** `POST /api/apollo/enrich-candidate` tries `apolloId` → `linkedinUrl` → `email`.

### Free-tier masking (PDL)

On the free tier PDL may return boolean **`true`** instead of a string for a field that exists
but is masked. The code detects this (`isMasked(value) === true`) and:

- Stores an empty string for the masked email/phone.
- Sets **`emailAvailable` / `phoneAvailable`** flags so the UI can show **"Masked — upgrade to Premium"** and the data can be revealed later on a paid plan.

The UI shows an amber "upgrade to Premium" banner when results contain masked contacts.

### Credit conservation (PDL)

- Default page size **5** (`PDL_SEARCH_SIZE`, clamped 1–100); all callers are hard-capped to this size.
- On a `402` (out of credits) the search **retries with smaller page sizes** (`[requested, 3, 1]`) and flags `creditLimited`.
- `creditsRemaining` is read from the `x-totallimit-remaining` response header and shown in the UI.
- Search-time caching avoids paying again to enrich what search already returned.
- A `404` (no records) is treated as an empty result, not an error.

### Mapping & import to Firestore

Raw provider data → `ApolloEnrichedPerson` → `enrichedToCandidateFields` (`mapper.ts`), which sets
`status: "new_lead"`, lowercases email, adds tags (`pdl`/`apollo`, role, state, certifications),
and records `apolloId`, `source`, and availability flags.

`importApolloPeopleToFirestore` (`import-server.ts`) **deduplicates**:

1. Skip if `apolloId` already exists.
2. Skip if email already exists (lowercased).
3. Optionally round-robin assign (if Settings auto-assign is on, manual import path only).
4. Create the candidate; optionally auto-enroll in the follow-up sequence.
5. Log activity and notify the assigned recruiter.

### Certifications (PDL only)

`extractCertification` scans job title, sub-role, and education against a healthcare credential
list (RN, NP, BSN, etc.) plus a phrase map, and stores a comma-separated `certification` value
(also expanded into tags).

### Duplicate detection

- **Import-time:** by `apolloId` and email (server).
- **Client-side:** `findDuplicateByEmail` before manual/CSV creates.
- **Admin merge tool:** `GET/POST /api/candidates/duplicates` groups candidates by normalized email and lets an admin delete duplicates (keeps one). Note: it deletes duplicate docs rather than merging fields, and can't catch records with empty emails.

---

## 9. Email system

### Sending (`POST /api/email/send`)

1. Verify auth; load candidate; reject if `optedOut`.
2. Load SMTP config from `settings/app` (rejects if not configured).
3. Resolve subject/body from the template and render variables.
4. Create the `outreachs` doc first to get a tracking ID.
5. **Decorate** the HTML (open pixel, click-wrapped links, unsubscribe footer).
6. Send via Nodemailer; write `outreachs`, `messages` (outbound), and `activities`; bump `new_lead` → `contacted`.

The Outreach page supports selecting **multiple candidates** and fans out one send per candidate.

### Template variables (`src/lib/email/template.ts`)

`{{firstName}}`, `{{role}}`, `{{location}}`, `{{company}}` (`company` = candidate's current employer).

### Email decoration (`src/lib/email/decorate.ts`)

- **Open tracking:** 1×1 GIF pixel → `/api/track/open?o={outreachId}` (increments `opens`, sets `openedAt`).
- **Click tracking:** links rewritten through `/api/track/click?o=&u=` (increments `clicks`, sets `firstClickAt`, then redirects).
- **Unsubscribe:** CAN-SPAM footer with an **HMAC-signed** link → `/api/unsubscribe?c=&t=` (token signed with `CRON_SECRET`).

### Inbound replies (`POST /api/email/inbound?secret=<INBOUND_SECRET>`)

Point your email provider's inbound-parse webhook here. Accepts JSON (Postmark-style) and form
payloads (SendGrid/Mailgun). When a known candidate replies, the system marks them **Replied**,
**stops their follow-up sequence**, flags the latest outreach as replied, stores the inbound
message, logs activity, and notifies the assigned recruiter.

### Test email (`POST /api/email/test`)

Sends a simple test message (defaults to the logged-in user's own address) to verify SMTP. Wired
to the **Profile → Send Test Email** card. Returns a clear error if SMTP isn't configured.

### SMTP configuration

SMTP credentials are **stored in Firestore** (`settings/app`), configured by an admin in
**Settings → SMTP Settings** — *not* in `.env.local`. Fields: host, port, secure (TLS), username,
password, plus the from-email. (e.g. Gmail uses `smtp.gmail.com:587` with an App Password.)

---

## 10. Automation engine (follow-up sequences)

The follow-up engine (`src/lib/automation/engine.ts`) drives a fixed **Day 1 / 3 / 7 / 14** cadence.

### Sequence steps (`SEQUENCE_STEPS`)

| Step | Offset | Label | Default subject |
|------|:------:|-------|-----------------|
| `day_1` | +1 day | Initial Email | `Healthcare opportunity at {{company}}` |
| `day_3` | +3 days | Follow-up #1 | `Following up — {{role}} opportunity` |
| `day_7` | +7 days | Follow-up #2 | `Quick check-in regarding your {{role}} role` |
| `day_14` | +14 days | Final Follow-up | `Last note — healthcare role in {{location}}` |

### Enrollment

`enrollCandidateInSequence()` immediately creates **all four** `followups` docs with status
`scheduled` and `scheduledFor = startDate + offset`. Enrollment happens via:

- **Manual:** candidate profile → "Enroll Sequence" (`POST /api/followups/enroll`, enroller becomes the recruiter).
- **On import:** Settings `autoEnrollOnImport` (manual Apollo import path only).
- **Auto-sourcing:** a rule with `autoEnroll` + an assigned recruiter.

### Engine run (`runAutomationEngine`)

On each run (cron or manual):

1. Load settings; **abort if SMTP not configured**.
2. **Business-hours gate:** if `businessHoursOnly` and the current server hour is outside `[sendStartHour, sendEndHour)`, the whole run is skipped.
3. **Daily cap:** if `dailyCap > 0`, count today's sent `outreachs`; the remaining headroom limits this run (cap counts **all** outreach, including manual sends).
4. Query due follow-ups (`status == scheduled` AND `scheduledFor <= now`).
5. For each:
   - Stop the sequence if the candidate has **replied** or **opted out**.
   - Skip if the candidate is missing, bounced, or has no email.
   - Render and send the email (decorated), mark the follow-up `sent`, write `outreachs`/`activities`, bump `new_lead` → `contacted`, notify the recruiter.
   - If the cap is hit mid-run, remaining follow-ups stay `scheduled` for the next run.

### Auto-stop conditions

| Event | Effect |
|-------|--------|
| Candidate replies (inbound webhook) | Status → `replied`, sequence stopped |
| Unsubscribe | `optedOut = true`, sequence stopped, all future sends blocked |
| Bounced / no email | That step is `skipped` |

---

## 11. Auto-sourcing (scheduled candidate discovery)

`src/lib/automation/sourcing-engine.ts` lets admins define **sourcing rules** (saved searches) on
the Auto-Sourcing page. Each rule stores job titles, locations, optional employer domains, a
per-run cap (clamped 1–50), an `enabled` flag, an `autoEnroll` toggle, and an optional assigned
recruiter.

When a rule runs (cron or manual):

1. Search the active provider for matching people.
2. Enrich them in batches of 10.
3. Import new candidates (dedup by Apollo ID + email), tagged `auto-sourced` plus role/state.
4. If `autoEnroll` and a recruiter is assigned, enroll imported candidates in the sequence.
5. Update rule run stats (`lastRunAt`, `lastRunImported`, `totalImported`).

Endpoints: `POST/PATCH/DELETE /api/sourcing` (admin CRUD), `POST /api/sourcing/run` (admin; optional
`{ ruleId }`), `GET /api/sourcing/cron` (cron secret; runs all enabled rules).

---

## 12. Auto-assignment (round-robin)

`pickRecruiterRoundRobin()` (`src/lib/automation/assignment.ts`) implements **least-loaded**
assignment: it counts each active recruiter's current candidate load (plus in-batch pending
assignments) and picks the lowest. Used on the **manual Apollo import** path when Settings
`autoAssign` is enabled. Auto-sourcing uses the rule's assigned recruiter instead.

---

## 13. Cron jobs & scheduling

`vercel.json` defines two scheduled GET endpoints:

| Path | Schedule (UTC) | Action |
|------|----------------|--------|
| `/api/automation/cron` | `0 8 * * *` (daily 08:00) | Send due follow-up emails |
| `/api/sourcing/cron` | `0 7 * * *` (daily 07:00) | Run all enabled sourcing rules |

**Protection:** if `CRON_SECRET` is set, requests must include `Authorization: Bearer <CRON_SECRET>`
(Vercel injects this automatically). If the secret is unset, the endpoints are unprotected — so set it.

**Manual triggers:** Followups page → "Run Automation Now" (`POST /api/automation/run`); Auto-Sourcing
page → "Run now" / "Run all enabled".

---

## 14. SMS (Twilio)

`POST /api/sms/send` sends an SMS via the Twilio REST API. Requires `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. It validates the phone, respects `optedOut`, and records
an `outreachs` doc with `channel: "sms"`. There is no dedicated SMS UI page (API-only).

---

## 15. AI assist

On the candidate detail page, AI assist can **draft an outreach email**, **summarize a candidate**,
and **suggest the next step**. It uses Groq when `GROQ_API_KEY` is set (model via `GROQ_MODEL`,
default `llama-3.3-70b-versatile`), and falls back to template-based output otherwise.

---

## 16. Notifications, tasks, saved views

- **Notifications** (`notifications` collection): live Firestore subscription powering the header bell. Types: reply received, candidate assigned, follow-up due/sent, task due. Recruiters see their own; admins see all.
- **Tasks** (`tasks` collection): per-user to-dos with due dates; a "due today" widget on the dashboard.
- **Saved views** (`savedViews` collection): reusable candidate filter combinations.

---

## 17. Security model

### Firestore rules (`firestore.rules`)

| Collection | Read | Write |
|-----------|------|-------|
| `users` | self or admin | admin only |
| `candidates` | active; admin all, recruiter only assigned | active; admin all, recruiter only assigned |
| `notes` | active users | create: active; update/delete: admin or author |
| `outreachs`, `followups`, `templates` | active users | active users |
| `activities` | admin only | create: active users |
| `settings` | active users | **admin only** |
| `sourcingRules` | admin | admin |
| `notifications` | own or admin | update: own or admin |
| `tasks`, `savedViews` | own | own |
| `messages` | active users | **no client writes** (server/Admin SDK only) |

Helpers: `isAdmin()`, `isRecruiter()`, `isActiveUser()`.

### Storage rules (`storage.rules`)

- `logos/{file}` — read/write by any authenticated user.
- `avatars/{userId}/{file}` — read by any authenticated user; write only by the owning uid.

### Other safeguards

- API routes verify Firebase ID tokens; admin endpoints require the admin role.
- Unsubscribe/inbound links use HMAC-signed tokens (`CRON_SECRET` / `INBOUND_SECRET`).
- `stripUndefined()` cleans payloads before Firestore writes to avoid `undefined`-field errors.

---

## 18. Environment variables

```bash
# Firebase Client (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server only)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Data provider: "apollo" | "pdl" (leave blank to auto-detect)
DATA_PROVIDER=
APOLLO_API_KEY=            # Apollo.io (paid API)
PDL_API_KEY=              # People Data Labs (free dev tier)
PDL_SEARCH_SIZE=5         # max profiles per PDL search (1-100)
APOLLO_SANDBOX=false      # true = built-in sample data, no credits

# Automation / security
CRON_SECRET=              # protects cron endpoints + signs unsubscribe tokens
INBOUND_SECRET=           # secures inbound email webhook (falls back to CRON_SECRET)
NEXT_PUBLIC_APP_URL=http://localhost:3000   # base URL for tracking/unsubscribe links

# Optional integrations
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
NEXT_PUBLIC_BOOKING_URL=  # interview scheduling link

# Seed script
SEED_ADMIN_EMAIL=admin@nightingale.com
SEED_ADMIN_PASSWORD=Admin123!
SEED_RECRUITER1_EMAIL=recruiter1@nightingale.com
SEED_RECRUITER2_EMAIL=recruiter2@nightingale.com
SEED_RECRUITER_PASSWORD=Recruit123!
SEED_DEMO_RECRUITERS=false
SEED_CLEAR_MOCK_CANDIDATES=false
```

> **SMTP credentials are NOT environment variables** — they're configured in the app under
> Settings → SMTP and stored in Firestore.

---

## 19. Setup & running locally

1. **Firebase:** create a project, enable Email/Password auth, Firestore, and Storage; generate a service account key.
2. **Env:** `cp .env.local.example .env.local` and fill in the Firebase + provider values.
3. **Rules:** `firebase deploy --only firestore:rules,firestore:indexes,storage` (or paste the rule files manually).
4. **Install & seed:**
   ```bash
   npm install
   npm run seed     # creates admin + (optional) recruiters + default settings
   npm run dev
   ```
5. Open <http://localhost:3000>.

### Default login credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@nightingale.com` | `Admin123!` |
| Recruiter | `recruiter1@nightingale.com` | `Recruit123!` |
| Recruiter | `recruiter2@nightingale.com` | `Recruit123!` |

> Recruiters are only seeded when `SEED_DEMO_RECRUITERS=true`. Candidates are **not** seeded —
> import them via Find Prospects. **Change these passwords before any real deployment.**

---

## 20. API reference

| Method & path | Auth | Purpose |
|---------------|------|---------|
| `POST /api/apollo/search` | ID token | Search the active provider |
| `POST /api/apollo/enrich` | ID token | Bulk enrich (max 10 IDs) |
| `POST /api/apollo/enrich-candidate` | ID token | Re-enrich an existing candidate |
| `POST /api/apollo/import` | ID token | Import people to CRM (with automation hooks) |
| `POST /api/apollo/lookup` | ID token | Single-profile lookup (LinkedIn/email/name) |
| `GET /api/apollo/status` | ID token | Provider health/config |
| `GET /api/candidates/duplicates` | ID token (admin UI) | Find email-duplicate groups |
| `POST /api/candidates/duplicates` | ID token | Merge (delete) duplicates |
| `POST /api/email/send` | ID token | Send a templated email |
| `POST /api/email/test` | ID token | Send an SMTP test email |
| `POST /api/email/inbound?secret=` | secret | Inbound reply webhook |
| `GET /api/track/open?o=` | none | Open-tracking pixel |
| `GET /api/track/click?o=&u=` | none | Click-tracking redirect |
| `GET /api/unsubscribe?c=&t=` | signed token | Unsubscribe (opt out) |
| `POST /api/sms/send` | ID token | Send SMS via Twilio |
| `POST /api/followups/enroll` | ID token | Enroll a candidate in the sequence |
| `POST /api/automation/run` | ID token | Run the follow-up engine now |
| `GET /api/automation/cron` | CRON_SECRET | Scheduled follow-up engine |
| `GET /api/sourcing` (client svc) / `POST/PATCH/DELETE /api/sourcing` | admin | Sourcing rule CRUD |
| `POST /api/sourcing/run` | admin | Run a rule (or all enabled) |
| `GET /api/sourcing/cron` | CRON_SECRET | Scheduled sourcing |
| `POST /api/recruiters` (and related) | admin | Recruiter management |
| `POST /api/ai` | ID token | AI draft/summarize/suggest |

---

## 21. Project structure

```
src/
├── app/
│   ├── (auth)/login/            # Login page
│   ├── (dashboard)/             # All authenticated pages (see §5)
│   │   ├── dashboard/ analytics/ activity/ candidates/ candidates/[id]/
│   │   ├── followups/ notes/ outreach/ pipeline/ profile/
│   │   ├── prospects/ recruiters/ settings/ sourcing/
│   │   └── layout.tsx
│   └── api/                     # Server routes (Admin SDK)
│       ├── ai/ apollo/ automation/ candidates/ email/
│       ├── followups/ recruiters/ sms/ sourcing/ track/ unsubscribe/
├── components/
│   ├── ui/                      # shadcn/Base UI primitives
│   ├── layout/                  # sidebar, header, nav-config, command palette, bell
│   ├── candidates/ dashboard/ shared/ providers/
├── context/auth-context.tsx
├── hooks/                       # use-debounce, use-mobile
├── lib/
│   ├── apollo/                  # provider abstraction (client, pdl, mapper, import-server, sandbox, errors)
│   ├── automation/              # engine, sourcing-engine, assignment, settings-server
│   ├── email/                   # mailer, template, decorate
│   ├── firebase/                # client, admin, converters, auth, storage
│   ├── services/                # Firestore CRUD per collection
│   ├── validations/             # Zod schemas
│   ├── constants.ts rbac.ts utils.ts api-client.ts analytics.ts app-url.ts
├── types/                       # index.ts, apollo.ts
scripts/seed.ts                  # seed users + settings
firestore.rules / firestore.indexes.json / storage.rules / vercel.json
```

---

## 22. Known limitations & edge cases

- **No duplicate enrollment guard:** calling enroll repeatedly creates duplicate sequences.
- **Daily cap is global:** it counts all outreach (manual + automated), not just sequence emails. The type comment says "per run" but the implementation is per calendar day.
- **Business hours abort the whole run** rather than individual messages, and use **server local time**.
- **PDL cache is in-process:** after a cold serverless instance, auto-sourcing enrichment may re-call PDL and spend extra credits.
- **Duplicate merge deletes** duplicate docs (doesn't merge fields) and can't catch records with empty emails (common with masked PDL data).
- **Cron endpoints are open if `CRON_SECRET` is unset** — always set it in production.
- **SMTP password is stored in Firestore in plain text** — acceptable for a small internal CRM, but consider a secret manager for production.

---

*Generated as living documentation. Source of truth is the code; if behavior and docs disagree,
trust the code and update this file.*
