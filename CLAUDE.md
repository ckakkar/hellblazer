# CLAUDE.md: Workout Tracker Build Spec

You are building a production workout-tracking web app. This file is the source of truth. Build the entire thing: schema, auth, RLS, data layer, UI, charts. Work in vertical slices (schema → types → data hooks → screen), and after each slice, run typecheck + lint before moving on. Don't scaffold placeholder screens: every screen listed here should be functional against real Supabase data before you call the build done.

## Stack (already initialized: do not re-scaffold)
- Next.js (App Router, TypeScript, `src/` dir): already created
- Supabase project: already created, connected via MCP
- Tailwind CSS
- Add: `@supabase/ssr`, `@supabase/supabase-js`, `recharts`, `date-fns`, `zod`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`

Use the Supabase MCP to run all migrations and RLS policies directly. Generate TypeScript types from the DB after the schema is live (`Supabase:generate_typescript_types`) and keep them in `src/lib/database.types.ts`. Regenerate whenever the schema changes.

## Non-negotiables
- **Auth: Google OAuth only.** No email/password, no magic links. Use `@supabase/ssr` with the App Router server-client pattern (middleware for session refresh, server components read session server-side). Protect all `/app/*` routes; unauthenticated → redirect to `/`.
- **RLS on every table**, enforced. Every user-owned row carries `user_id uuid references auth.users`. Policies: a user can only CRUD their own rows. The exercise library is the one shared read-only table (see schema).
- **Multi-user from day one.** No hardcoded user assumptions. The app is for me but others will sign up.
- **No secrets in client code.** `NEXT_PUBLIC_SUPABASE_URL` and anon key only client-side; never expose the service role key.

---

## Data Model

Structure is **template-based with ad-hoc override**: users build reusable workout templates (e.g. a 5-day split), then each logged session can either instantiate a template or be freeform. Logging always writes to the same `set` grain regardless of source.

### `exercise` (shared library, read-only to users)
Seed this table: do not make users create base exercises. Owner-created custom exercises allowed via nullable `user_id`.
- `id uuid pk default gen_random_uuid()`
- `user_id uuid null references auth.users`, null = global/seeded; non-null = user's custom exercise
- `name text not null`
- `primary_muscle text not null`: enum-like (see muscle list below)
- `secondary_muscles text[] default '{}'`
- `mechanic text`: `'compound' | 'isolation'`
- `equipment text`: `'barbell'|'dumbbell'|'cable'|'machine'|'bodyweight'|'other'`
- `default_rep_range text`: e.g. `'3-5'`, `'8-12'`
- RLS: select where `user_id is null or user_id = auth.uid()`; insert/update/delete only where `user_id = auth.uid()`.

**Muscle enum (use a Postgres enum `muscle_group`):** `chest, back, side_delt, rear_delt, front_delt, biceps, triceps, quads, hamstrings, glutes, calves, abs, forearms, traps`.

### `workout_template`
- `id uuid pk`, `user_id uuid not null`, `name text not null`, `day_label text` (e.g. "Day 1: Upper"), `position int` (ordering within a user's split), `created_at timestamptz default now()`

### `template_exercise`
Ordered exercises within a template with prescribed sets/reps.
- `id uuid pk`, `user_id uuid not null`, `template_id uuid references workout_template on delete cascade`
- `exercise_id uuid references exercise`
- `position int`, `target_sets int`, `target_rep_range text`, `note text`

### `session`
One training session on one date.
- `id uuid pk`, `user_id uuid not null`
- `template_id uuid null references workout_template`, null = freeform
- `date date not null default current_date`
- `title text`: defaults from template day_label, editable
- `notes text`, `duration_min int null`
- `created_at timestamptz default now()`

### `session_exercise`
Exercises actually performed in a session (copied from template on instantiate, or added ad-hoc).
- `id uuid pk`, `user_id uuid not null`, `session_id uuid references session on delete cascade`
- `exercise_id uuid references exercise`
- `position int`, `note text`

### `set`
The atomic logged unit. This is where all analytics come from.
- `id uuid pk`, `user_id uuid not null`, `session_exercise_id uuid references session_exercise on delete cascade`
- `set_number int not null` (1-indexed within the exercise)
- `weight_kg numeric(6,2) not null`
- `reps int not null`
- `rpe numeric(3,1) null`: optional, allow 0-10 in 0.5 steps
- `is_warmup boolean default false`
- `is_completed boolean default true`
- `created_at timestamptz default now()`

### `bodyweight_log` (optional but include)
- `id uuid pk`, `user_id uuid not null`, `date date`, `weight_kg numeric(5,2)`

### Derived analytics: do NOT store, compute:
- **Est. 1RM (Epley):** `weight * (1 + reps/30)`, working sets only (`is_warmup = false`). Chart best-per-session over time per exercise.
- **Volume:** `sum(weight_kg * reps)` for working sets, aggregated per session, per exercise, and rolled up per `primary_muscle` (secondary muscles count at 0.5 weight toward their muscle's volume: implement this in the aggregation layer, documented).
- **Weekly sets per muscle:** count of working sets grouped by ISO week and primary muscle. Secondary muscles add 0.5 sets each. This is the weak-point tracking view.

Create Postgres **views or RPC functions** for the heavy aggregations (weekly sets per muscle, volume per muscle per week, 1RM progression per exercise) so the client fetches pre-aggregated data instead of pulling every set. Expose via `Supabase:execute_sql`/`apply_migration`. RLS must still apply: use security-invoker views or RPCs that filter on `auth.uid()`.

---

## Screens (App Router, all under `/app` route group, auth-gated)

1. **`/` (landing / login)**: dark hero, product name, single "Continue with Google" button. If already authed, redirect to `/dashboard`.
2. **`/dashboard`**. Top: this-week summary cards (sessions logged, total volume, est. weekly sets per weak-point muscle: back/biceps/triceps/side_delt highlighted). Below: **weekly-sets-per-muscle bar chart** (the flagship view) and a **volume trend** line chart. Recent sessions list.
3. **`/log`**: start a session. Pick a template (instantiates its exercises) or start freeform. Then a **fast set-logging interface**: per exercise, rows of set # / weight / reps / RPE, with a "+ set" that pre-fills the previous set's weight/reps (the single biggest UX win, copy-forward). Show last session's numbers for the same exercise inline as a target ("last: 60kg×5"). Big tap targets: this is used mid-workout, likely on mobile.
4. **`/history`**: reverse-chron session list, filterable by template/date. Click into a session → full detail, editable.
5. **`/progress`**: per-exercise deep dive: select an exercise → est. 1RM line chart + volume bars + a PR table (heaviest weight, best est. 1RM, best set volume). Muscle-level tab: volume-per-muscle-over-time and weekly-sets-per-muscle trend.
6. **`/templates`**: CRUD your split. Build a template, add exercises from the library (searchable), set target sets/reps/notes, order them. This is where the user's 5-day split lives.
7. **`/exercises`**: browse the seeded library, create custom exercises.
8. **`/settings`**: units (default kg, allow lb display toggle, store canonical kg always, convert at display), bodyweight log entry, sign out.

---

## Design System: Dark Cyberpunk, Minimal

Not neon-vomit. Restrained, high-craft, deep charcoal base with a single electric accent. Think "engineered instrument panel," not "gamer RGB."

### Tokens (define as CSS variables in `globals.css`, map into Tailwind theme)
```
--bg:            #0A0B0D   /* near-black base */
--surface:       #101216   /* cards */
--surface-2:     #16191F   /* elevated / hover */
--border:        #1F242C
--text:          #E6E9EF
--text-muted:    #8B93A1
--accent:        #00E5C7   /* electric teal, primary accent, single hue */
--accent-dim:    #0B8F80
--accent-glow:   rgba(0,229,199,0.14)  /* for subtle glows only */
--danger:        #FF4D6D
--warn:          #FFB020
--chart-1:       #00E5C7
--chart-2:       #6C8BFF
--chart-3:       #B980FF
--chart-4:       #FF6FB5
```
### Rules
- **One accent hue.** Teal. Use blue/violet/pink only inside charts to differentiate series. UI chrome stays monochrome + teal.
- **Glow, sparingly.** A faint `box-shadow` in `--accent-glow` on primary buttons and active nav only. Never on text blocks.
- **Type:** UI in Geist or Inter (variable). Numbers/data in a monospace (Geist Mono / JetBrains Mono), weights, reps, 1RM all tabular-nums. This is the cyberpunk-instrument feel: mono data, clean sans labels.
- **Borders over shadows** for separation, 1px `--border`, subtle. Elevation via `--surface-2`, not big drop shadows.
- **Radius:** consistent `rounded-lg` (10-12px). No pill buttons except tags.
- **Spacing:** generous. Let cards breathe. 8pt grid.
- **Motion:** Framer Motion optional but keep it subtle, 150-200ms ease-out on mount/hover, no bouncy springs. Respect `prefers-reduced-motion`.
- **Charts (recharts):** dark bg, `--border` gridlines at low opacity, accent-colored series, mono tick labels, tooltips on `--surface-2` with 1px border. No chart legends where a single series is obvious. Keep them clean and data-dense.
- **Mobile-first for `/log`.** It's the mid-workout screen: thumb-reachable, large inputs, minimal chrome. Everything else can be desktop-comfortable but must not break on mobile.

### Component conventions
- Build a tiny primitives layer: `Button`, `Card`, `Input`, `NumberStepper` (for weight/reps, increment buttons flanking a numeric input, big tap targets), `Select`, `StatCard`, `ChartCard`. Use `cva` for variants. Don't pull in a heavy component library. Keep it hand-built and lean to preserve the aesthetic.
- Navigation: persistent left sidebar on desktop (icon + label, lucide icons), bottom tab bar on mobile.

---

## Build Order (follow this)
1. Env + Supabase server/client setup (`@supabase/ssr`), middleware session refresh, Google OAuth flow, `/` login + auth-gating on `/app/*`.
2. Full schema migration via MCP: enum, all tables, FKs, indexes on `user_id` + common query columns (`session.date`, `set.session_exercise_id`).
3. RLS policies on every table. Verify by attempting a cross-user read (should return zero rows).
4. Seed `exercise` library: pull a solid starter set (~40-60 common lifts) covering every muscle_group, with mechanic/equipment/primary+secondary muscles filled. Include everything in my split: bench, incline DB press, OHP, pendlay row, seated cable row, weighted pullup, lat pulldown, lat pullover, chest-supported row, barbell curl, incline DB curl, lean-forward cable curl, preacher curl, close-grip bench, skull crusher, overhead cable extension, rope pushdown, DB/cable side delt, rear delt fly, face pull, RDL, leg press, hamstring curl, leg ext, hip adduction/abduction, calf raise.
5. Generate DB types → `database.types.ts`.
6. Aggregation views/RPCs (weekly sets per muscle, volume per muscle/week, 1RM per exercise).
7. Data-access layer: typed query functions / React hooks per entity. No raw Supabase calls scattered in components.
8. Design primitives + globals + Tailwind token wiring.
9. Screens in order: templates → log → history → progress → dashboard → exercises → settings.
10. Seed my actual 5-day split as a set of templates so I have data to see immediately (use the final split: 5 days, weak-point focus on back/biceps/triceps/side delts; Day 4 uses rear delt fly, Day 5 uses hip adduction).

## Definition of done
- `npm run build` passes clean (no TS errors, no lint errors).
- Google sign-in works end-to-end; a second Google account sees zero of the first account's data (RLS proven).
- I can: build a template, start a session from it, log sets with copy-forward, see it in history, and watch the dashboard + progress charts populate from real logged data.
- Every chart renders with real aggregated data, not mock arrays.
- Mobile `/log` is genuinely usable one-handed.

## Guardrails
- Ask before destructive migrations if data already exists. Otherwise proceed autonomously through the build order.
- Keep canonical weight in kg everywhere; convert only at display.
- Don't over-engineer: no Redux, no tRPC, no heavy state lib. Server components + Supabase + minimal client state (React state / URL params) is enough.
- Commit in logical chunks with clear messages.
