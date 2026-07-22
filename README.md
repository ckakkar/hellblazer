# OVERLOAD

**Progressive overload, instrumented.** A precision workout tracker built around a fast, mobile-first set logger and a live analytics engine. Log the set — watch the numbers move.

Built with Next.js (App Router) and Supabase, with row-level security isolating every user's data from day one.

---

## Features

- **Google sign-in only** — no passwords, no magic links. PKCE OAuth via `@supabase/ssr`.
- **Template-driven training** — build your split once (e.g. a 5-day weak-point split), then instantiate a session in a tap. Freeform sessions supported too.
- **Fast set logging** — the mid-workout screen. Copy-forward sets (the previous set's weight/reps pre-fill the next), inline "last: 60kg×5" targets, big thumb targets, debounced autosave that can't create duplicates.
- **Live analytics** — estimated 1RM (Epley), volume, and **weekly sets-per-muscle**, all computed server-side from Postgres views. Secondary muscles are weighted 0.5 toward their muscle's volume and set count.
- **Weak-point tracking** — back · biceps · triceps · side delts are highlighted everywhere.
- **Per-exercise progress** — 1RM line, volume bars, and a PR table (heaviest weight, best est. 1RM, best set volume).
- **Exercise library** — ~60 seeded lifts covering every muscle group, plus your own custom exercises.
- **kg/lb display** — canonical storage is always kilograms; conversion happens only at display.
- **Multi-user & secure** — RLS on every table; a second account sees zero of the first account's data.
- **Mobile-first** — safe-area insets (notch + home indicator), 16px input floor (no iOS focus-zoom), native tap feedback, bottom tab bar.

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Landing / Google sign-in (redirects to `/dashboard` if authed) |
| `/dashboard` | This-week summary, weak-point cards, weekly-sets-per-muscle chart, volume trend, recent sessions |
| `/log` → `/log/[id]` | Start a session (template or freeform), then the fast set logger |
| `/history` → `/history/[id]` | Filterable session list; editable detail |
| `/progress` | Per-exercise 1RM/volume/PRs, and per-muscle trends |
| `/templates` | CRUD your split; one-click starter-split preset |
| `/exercises` | Browse the library; create custom exercises |
| `/settings` | Units toggle, bodyweight log, sign out |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | **Next.js 16** (App Router, TypeScript, `src/`) |
| Backend | **Supabase** — Postgres, Auth, Row-Level Security |
| Data access | `@supabase/ssr` (server/browser clients + session refresh) |
| Styling | **Tailwind CSS v4** (CSS-first tokens), `class-variance-authority` |
| Charts | **Recharts** |
| Dates | **date-fns** |
| Validation | **Zod** (every Server Action input) |
| Icons | **lucide-react** |

> **Note for contributors:** this repo pins a build of Next.js where **Middleware has been renamed to Proxy**. Session refresh lives in [`src/proxy.ts`](src/proxy.ts) (exporting a `proxy` function), not `middleware.ts`. `cookies()`, `params`, and `searchParams` are all async. Read the bundled docs under `node_modules/next/dist/docs/` before making framework-level changes.

---

## Architecture

```
src/
├─ proxy.ts                 # Next 16 "middleware" — refreshes session, gates routes
├─ app/
│  ├─ page.tsx              # landing / login
│  ├─ auth/callback/        # OAuth PKCE code exchange (route handler)
│  └─ (app)/                # auth-gated route group (sidebar + bottom nav shell)
│     ├─ dashboard, log, history, progress, templates, exercises, settings
├─ components/
│  ├─ ui/                   # hand-built primitives (Button, Card, NumberStepper, Sheet…)
│  ├─ charts/               # recharts client components
│  └─ nav/                  # sidebar + mobile top/bottom bars
└─ lib/
   ├─ supabase/             # browser client, server client, proxy session helper
   ├─ data/                 # typed read queries per entity (server-only)
   ├─ actions/              # Server Actions (mutations, zod-validated)
   ├─ presets.ts            # loadable starter routines
   ├─ database.types.ts     # generated from the live schema
   └─ muscles.ts, units.ts, settings.ts, utils.ts
```

**Data flow:** Server Components read via `lib/data/*`; mutations go through `lib/actions/*` (each re-checks auth and validates input with Zod). No raw Supabase calls are scattered in components. RLS is the security boundary — the client only ever holds the public `anon`/publishable key.

### Data model

`exercise` (shared library, `user_id` nullable) · `workout_template` → `template_exercise` · `session` → `session_exercise` → `set` · `bodyweight_log`. A `muscle_group` Postgres enum drives the taxonomy.

**Derived analytics are never stored — they're computed** in security-invoker Postgres views so RLS still applies:

| View | Gives |
| --- | --- |
| `v_working_set` | Per working set: est. 1RM (`weight × (1 + reps/30)`) and volume |
| `v_weekly_sets_per_muscle` | Weekly sets & volume per muscle (ISO week; secondary muscles ×0.5) |
| `v_exercise_progression` | Best 1RM / top weight / volume per exercise per session |
| `v_session_summary` | Per-session totals for history & dashboard |

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (schema, RLS, views and seed data are applied via migrations)

### 1. Install

```bash
npm install
```

### 2. Environment

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-publishable-or-anon-key>
```

Find both under **Supabase → Project Settings → API**. Only public keys are used client-side — never expose the service-role key.

### 3. Enable Google sign-in (required)

Sign-in won't work until the Google provider is configured:

1. **Supabase → Authentication → Providers → Google:** enable it, and paste your Google Cloud OAuth **Client ID** and **Client Secret**.
2. **Google Cloud Console → Credentials → Authorized redirect URIs:** add
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. **Supabase → Authentication → URL Configuration:** add your app origins to **Site URL** and **Redirect URLs**, e.g. `http://localhost:3000/**` (and your production origin).

The app-side callback is [`/auth/callback`](src/app/auth/callback/route.ts); the sign-in button requests `redirectTo = <origin>/auth/callback`.

### 4. Run

```bash
npm run dev      # http://localhost:3000
```

Sign in → open **Templates** and load the **Back & Arm Focused Strength** starter split → start a session from it → log a few sets → watch the dashboard and progress charts populate.

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (runs TypeScript) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (run separately — `build` does not lint) |

---

## Design system

Dark cyberpunk, minimal — an "engineered instrument panel," not gamer RGB. Deep charcoal base (`#0A0B0D`) with a single electric-teal accent (`#00E5C7`). Clean sans (Geist) for labels, **monospace with tabular numerals** for all data (weights, reps, 1RM). Borders over shadows; one accent hue in the UI, with blue/violet/pink reserved for differentiating chart series. Tokens are defined as CSS variables in [`globals.css`](src/app/globals.css) and mapped into the Tailwind theme.

## Deployment

Deploy on Vercel (or any Node host). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the host's environment, add your production origin to the Supabase redirect allowlist, and you're live.

---

_Built with Next.js + Supabase. RLS-isolated, multi-user from day one._
