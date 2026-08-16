# PowerHealth

Mobile app for GymPower Health — one app, two roles (**member** / **admin**),
built with Expo + Supabase.

## What's built

- **Auth** — email/password signup & login (Supabase Auth), role-based routing
- **Member app** — home (membership status, latest BMI, announcements), class
  browsing & booking with waitlist, BMI progress history, diet/workout plan
  viewer, workout self-logging, profile
- **Admin app** — dashboard (membership stats), member directory & detail
  (edit subscription dates, log BMI machine readings, assign diet/workout
  plans), class scheduling (Yoga/Boxing/Plank/Stretching/Zumba/Hyrox + custom
  types), announcements

Payments are handled outside the app, so there's no billing integration.
Check-in (QR/geofence) is scoped out of v1 — see "What's not built" below.

## Stack

- **Expo (SDK 57) + Expo Router + TypeScript** — file-based navigation, one
  codebase for iOS/Android
- **Supabase** — Postgres, Auth, Row-Level Security for role-based data
  access; no separate backend to run

## Setup

### 1. Create a Supabase project

Create a project at [supabase.com](https://supabase.com) (free tier is fine
to start).

### 2. Run the migrations

Install the Supabase CLI, then from this folder:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This runs both files in `supabase/migrations/` in order:

- `0001_initial_schema.sql` — tables, the `profiles` auto-create trigger,
  membership status logic, and the class seat-count view
- `0002_rls_policies.sql` — Row-Level Security policies (members only ever
  see their own data; admins see and manage everything)

### 3. Configure the app

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from
**Supabase Dashboard → Project Settings → API**.

### 4. Install and run

```bash
npm install
npm run android   # or: npm run ios / npm run web
```

### 5. Create your first admin account

Every new signup starts as a `member` (see the `handle_new_user` trigger).
To promote an account to admin, sign up normally in the app, then in the
Supabase SQL editor:

```sql
update profiles set role = 'admin' where id = '<user-uuid-from-auth-users>';
```

You can find the UUID in **Authentication → Users** in the dashboard.

## Keeping membership statuses fresh

A membership's `status` (`active` / `expiring_soon` / `expired`) is computed
from its dates automatically whenever the row is inserted or updated. But a
membership nobody touches should still flip to `expired` as its end date
passes — for that, call:

```sql
select refresh_membership_statuses();
```

Options for running this automatically:
- **pg_cron** (if enabled on your Supabase project): schedule it daily
- Or trigger it from a Supabase Edge Function on a cron schedule
- Or just call it manually / from the admin dashboard for now — it's cheap
  and idempotent

## What's not built yet (intentionally scoped out of v1)

- **Check-in** (QR/geofence) — you said this isn't needed for v1. When you
  add it, a 24/7 gym like this one usually leans QR/geofence over
  front-desk marking since there's no staff overnight.
- **In-app payments** — handled offline per your instruction. Adding
  Razorpay/Stripe later wouldn't require reworking the schema.
- **Push notifications** — announcements currently only show in-app; wiring
  up Expo push notifications for new announcements/class reminders is a
  natural next step.
- **Delete Account flow** — required by Apple App Store guideline 5.1.1(v)
  before you can submit to the App Store. Worth building before launch.

## Project structure

```
app/
  _layout.tsx          # root layout: auth state -> redirects to (auth)/(member)/(admin)
  (auth)/               login, signup
  (member)/              home, classes, bmi, plans, profile (tab bar)
  (admin)/               dashboard, members (list + detail), classes, announcements (tab bar)
components/ui.tsx       # shared design system (Screen, Card, Button, Input, Badge...)
constants/theme.ts       # colors, spacing, font sizes
contexts/AuthContext.tsx # Supabase session + profile/role state
lib/supabase.ts          # Supabase client (SecureStore-backed session persistence)
types/database.ts        # TypeScript types mirroring the schema
supabase/migrations/     # SQL migrations (schema + RLS policies)
```
