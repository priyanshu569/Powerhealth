-- PowerHealth: initial schema
-- Run via: npx supabase db push  (after `npx supabase link`)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users row, holds app-level role + display info
-- ---------------------------------------------------------------------------
create type user_role as enum ('member', 'admin');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'member',
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Auto-create a profiles row whenever someone signs up via Supabase Auth.
-- New accounts always start as 'member' — promote to 'admin' manually:
--   update profiles set role = 'admin' where id = '<user-uuid>';
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- memberships: admin-managed subscription window per member
-- ---------------------------------------------------------------------------
create type membership_status as enum ('active', 'expiring_soon', 'expired', 'frozen');

create table memberships (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id) on delete cascade,
  plan_name text not null,
  start_date date not null,
  end_date date not null,
  status membership_status not null default 'active',
  notes text,
  updated_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memberships_member_id_idx on memberships (member_id);

-- Recompute status from dates whenever a row is inserted/updated, and expose
-- a helper the admin dashboard (or a daily pg_cron job) can call to refresh
-- everyone's status as time passes without an explicit edit.
create function public.compute_membership_status(p_start date, p_end date, p_current membership_status)
returns membership_status
language plpgsql
immutable
as $$
begin
  if p_current = 'frozen' then
    return 'frozen'; -- frozen is a manual admin state, dates don't override it
  end if;
  if p_end < current_date then
    return 'expired';
  end if;
  if p_end <= current_date + interval '5 days' then
    return 'expiring_soon';
  end if;
  return 'active';
end;
$$;

create function public.memberships_set_status()
returns trigger
language plpgsql
as $$
begin
  new.status := public.compute_membership_status(new.start_date, new.end_date, coalesce(new.status, 'active'));
  new.updated_at := now();
  return new;
end;
$$;

create trigger memberships_before_write
  before insert or update on memberships
  for each row execute procedure public.memberships_set_status();

-- Call this periodically (e.g. via pg_cron, or a button on the admin
-- dashboard) so memberships flip to expiring_soon/expired as dates pass,
-- even for rows nobody has touched recently.
create function public.refresh_membership_statuses()
returns void
language sql
security definer set search_path = public
as $$
  update memberships
  set status = public.compute_membership_status(start_date, end_date, status)
  where status <> public.compute_membership_status(start_date, end_date, status);
$$;

-- ---------------------------------------------------------------------------
-- bmi_records: readings from the gym's BMI machine, logged by admin/staff
-- ---------------------------------------------------------------------------
create table bmi_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id) on delete cascade,
  recorded_at date not null default current_date,
  weight_kg numeric(5, 1),
  height_cm numeric(5, 1),
  bmi numeric(4, 1),
  body_fat_pct numeric(4, 1),
  muscle_mass_kg numeric(5, 1),
  visceral_fat numeric(4, 1),
  notes text,
  recorded_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index bmi_records_member_id_idx on bmi_records (member_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- class_types + classes: the schedule (yoga, boxing, zumba, hyrox, ...)
-- ---------------------------------------------------------------------------
create table class_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  color text,
  is_active boolean not null default true
);

insert into class_types (name) values
  ('Yoga'), ('Boxing'), ('Plank'), ('Stretching'), ('Zumba'), ('Hyrox');

create type class_recurrence as enum ('once', 'weekly');

create table classes (
  id uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references class_types (id) on delete cascade,
  trainer_name text,
  title text,
  day_of_week smallint check (day_of_week between 0 and 6),
  session_date date,
  start_time time not null,
  duration_minutes integer not null default 45,
  capacity integer not null default 15,
  recurrence class_recurrence not null default 'weekly',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint classes_schedule_check check (
    (recurrence = 'weekly' and day_of_week is not null and session_date is null)
    or (recurrence = 'once' and session_date is not null and day_of_week is null)
  )
);

create index classes_active_idx on classes (is_active);

-- ---------------------------------------------------------------------------
-- class_bookings: member bookings, with a public aggregate view for seat
-- counts so members can see how full a class is without RLS exposing
-- other members' individual booking rows to them.
-- ---------------------------------------------------------------------------
create type booking_status as enum ('booked', 'waitlisted', 'cancelled');

create table class_bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes (id) on delete cascade,
  member_id uuid not null references profiles (id) on delete cascade,
  status booking_status not null default 'booked',
  booked_at timestamptz not null default now(),
  unique (class_id, member_id)
);

create index class_bookings_class_id_idx on class_bookings (class_id);
create index class_bookings_member_id_idx on class_bookings (member_id);

-- Owned by the migration role, so it runs with that role's privileges and
-- is exempt from the class_bookings RLS policies below — intentional, this
-- view only ever exposes an aggregate count, never individual member rows.
create view class_capacity_view as
select
  class_id,
  count(*) filter (where status = 'booked') as booked_count,
  count(*) filter (where status = 'waitlisted') as waitlisted_count
from class_bookings
group by class_id;

-- ---------------------------------------------------------------------------
-- trainer_sessions: 1-on-1 bookings, either member-requested or admin-assigned
-- ---------------------------------------------------------------------------
create type trainer_session_status as enum ('requested', 'confirmed', 'completed', 'cancelled');

create table trainer_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id) on delete cascade,
  trainer_name text not null,
  requested_by user_role not null,
  session_date date not null,
  start_time time not null,
  status trainer_session_status not null default 'requested',
  notes text,
  created_at timestamptz not null default now()
);

create index trainer_sessions_member_id_idx on trainer_sessions (member_id);

-- ---------------------------------------------------------------------------
-- diet_plans + workout_plans: admin/trainer-authored, assigned per member
-- ---------------------------------------------------------------------------
create table diet_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id) on delete cascade,
  created_by uuid not null references profiles (id),
  title text not null,
  content text not null,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index diet_plans_member_id_idx on diet_plans (member_id, is_active);

create table workout_plans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id) on delete cascade,
  created_by uuid not null references profiles (id),
  title text not null,
  content text not null,
  start_date date not null default current_date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index workout_plans_member_id_idx on workout_plans (member_id, is_active);

-- ---------------------------------------------------------------------------
-- workout_logs: member's own self-logged workouts (separate from the
-- trainer-authored workout_plans above)
-- ---------------------------------------------------------------------------
create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id) on delete cascade,
  logged_at timestamptz not null default now(),
  exercise text not null,
  sets integer,
  reps integer,
  weight_kg numeric(5, 1),
  notes text,
  created_at timestamptz not null default now()
);

create index workout_logs_member_id_idx on workout_logs (member_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- announcements: admin broadcasts to all members
-- ---------------------------------------------------------------------------
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index announcements_created_at_idx on announcements (created_at desc);
