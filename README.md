# PowerHealth

Mobile app for GymPower Health — one app, two roles (**member** / **admin**),
built with Expo + Supabase.

## What's built

- **Auth** — email/password signup & login (Supabase Auth), role-based
  routing, account deletion (Apple guideline 5.1.1(v))
- **Push notifications** — new announcements and 30-minute class reminders,
  sent via `pg_net` (see "Push notifications" below for the EAS setup this
  needs before it actually delivers anything)
- **Member app** — home (membership status, latest BMI, announcements), class
  browsing & booking with waitlist, trainer session requests, BMI progress
  history, diet/workout plan viewer, workout self-logging, profile
- **Admin app** — dashboard (membership stats, pending trainer requests),
  member directory & detail (edit subscription dates, log BMI machine
  readings, assign diet/workout plans, assign trainer sessions), class
  scheduling (Yoga/Boxing/Plank/Stretching/Zumba/Hyrox + custom types),
  announcements, profile

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

This runs every file in `supabase/migrations/` in order:

- `0001_initial_schema.sql` — tables, the `profiles` auto-create trigger,
  membership status logic, and the class seat-count view
- `0002_rls_policies.sql` — Row-Level Security policies (members only ever
  see their own data; admins see and manage everything)
- `0003_grants.sql` — table-level `GRANT`s to `authenticated`. RLS alone
  isn't enough for Postgres to allow a query; this is what Supabase's
  dashboard normally does for you automatically, which the CLI doesn't
- `0004_membership_refresh_schedule.sql` — schedules
  `refresh_membership_statuses()` daily via `pg_cron`, plus an admin-gated
  RPC for the dashboard's manual refresh button
- `0005_delete_account.sql` — self-service account deletion
- `0006_lock_down_function_execute.sql` — revokes the default `PUBLIC`
  execute grant Postgres adds to every function, restricting each to what
  actually needs to call it
- `0007_push_notifications.sql` — `push_tokens` table, a trigger that pushes
  every member on new announcements, and a `pg_cron` job that pushes members
  with a booked class starting in 20-30 minutes — see "Push notifications"
  below before this does anything

If you're running `npx supabase login` somewhere without a browser (CI, a
non-interactive shell), generate a personal access token at
[app.supabase.com/account/tokens](https://app.supabase.com/account/tokens)
and set it as `SUPABASE_ACCESS_TOKEN` instead.

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
from its dates automatically whenever the row is inserted or updated. A
membership nobody touches still needs to flip to `expired` as its end date
passes — `0004_membership_refresh_schedule.sql` handles this with a daily
`pg_cron` job (00:15 IST) that calls `refresh_membership_statuses()`.

Admins can also trigger it on demand from the **Refresh membership statuses**
button on the Dashboard tab, which calls the admin-gated
`admin_refresh_membership_statuses()` RPC.

## Push notifications

Sent directly from Postgres via `pg_net` (see `0007_push_notifications.sql`)
— no Edge Function needed. A trigger pushes every member when an admin
posts a new announcement; a `pg_cron` job checks every 10 minutes for
classes starting in 20-30 minutes and pushes members with a `booked` (not
waitlisted) status for that class.

The client side (`lib/pushNotifications.ts`, wired into `AuthContext`)
registers a device's push token on sign-in and removes it on sign-out. For
this to actually deliver anything, two things need to happen first, neither
of which is a code change:

1. **Link an EAS project**: `npx eas init` (needs an Expo account) — this
   writes `extra.eas.projectId` into `app.json`. Without it, registration
   silently no-ops (check the console for a `[push] no EAS project ID`
   warning).
2. **Build a development build**: since Expo SDK 53, Expo Go no longer
   supports remote push notifications at all — `npx eas build --profile
   development` (or a production build) on a **physical device** is
   required to test this; simulators/emulators can't receive push either.

## Dependency audit

`npm audit` currently reports 14 high-severity findings, all one root cause:
`image-size` (used internally by the Metro bundler to read image dimensions
during builds) has a DoS advisory with no patched version published yet —
confirmed by checking npm's registry directly. It's a build-tool dependency,
not something that ships in the app or runs on a member's phone, and the
vulnerable code path only triggers on a maliciously crafted ICNS/JXL/HEIF
file entering the *build* pipeline, not on anything this app's own assets or
runtime data touch. **Don't run `npm audit fix --force`** — its suggested
fix downgrades `expo` to `53.0.27` and `react-native` to `0.72.17`, multiple
major versions back, which would break every SDK-57-pinned package here.
Re-run `npm audit` after future `expo`/`metro` updates to check if upstream
has shipped a fix.

A separate, already-fixed issue: `uuid@7.0.3` (pulled in via `xcode`, used
for iOS project file generation) had a moderate buffer-bounds advisory.
`package.json`'s `overrides` pins it to `^11.1.1` — safe since `xcode` was
the only consumer in the tree.

## What's not built yet (intentionally scoped out of v1)

- **Check-in** (QR/geofence) — you said this isn't needed for v1. When you
  add it, a 24/7 gym like this one usually leans QR/geofence over
  front-desk marking since there's no staff overnight.
- **In-app payments** — handled offline per your instruction. Adding
  Razorpay/Stripe later wouldn't require reworking the schema.

## Project structure

```
app/
  _layout.tsx          # root layout: auth state -> redirects to (auth)/(member)/(admin)
  (auth)/               login, signup
  (member)/              home, classes, trainer, bmi, plans, profile (tab bar)
  (admin)/               dashboard, members (list + detail), classes, announcements, profile (tab bar)
components/ui.tsx       # shared design system (Screen, Card, Button, Input, Badge...)
constants/theme.ts       # colors, spacing, font sizes
contexts/AuthContext.tsx # Supabase session + profile/role state
lib/supabase.ts          # Supabase client (SecureStore-backed session persistence)
lib/pushNotifications.ts # Expo push token registration
types/database.ts        # TypeScript types mirroring the schema
supabase/migrations/     # SQL migrations (schema, RLS, grants, cron, account deletion, push)
```
