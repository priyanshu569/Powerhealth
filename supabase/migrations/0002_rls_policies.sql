-- PowerHealth: row-level security policies
-- Every table is member/admin scoped: members only ever see their own rows
-- (plus public schedule/announcement data); admins see and manage everything.

-- Helper: is the current user an admin? Used throughout instead of repeating
-- the subquery in every policy.
create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_own_or_admin"
  on profiles for update
  using (id = auth.uid() or public.is_admin());

-- profiles rows are only ever created by the handle_new_user trigger
-- (security definer), so no insert policy is needed for regular clients.

-- ---------------------------------------------------------------------------
-- memberships
-- ---------------------------------------------------------------------------
alter table memberships enable row level security;

create policy "memberships_select_own_or_admin"
  on memberships for select
  using (member_id = auth.uid() or public.is_admin());

create policy "memberships_admin_write"
  on memberships for insert
  with check (public.is_admin());

create policy "memberships_admin_update"
  on memberships for update
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- bmi_records
-- ---------------------------------------------------------------------------
alter table bmi_records enable row level security;

create policy "bmi_records_select_own_or_admin"
  on bmi_records for select
  using (member_id = auth.uid() or public.is_admin());

create policy "bmi_records_admin_write"
  on bmi_records for insert
  with check (public.is_admin());

create policy "bmi_records_admin_update"
  on bmi_records for update
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- class_types / classes — readable by any signed-in member or admin,
-- writable by admin only
-- ---------------------------------------------------------------------------
alter table class_types enable row level security;

create policy "class_types_select_authenticated"
  on class_types for select
  to authenticated
  using (true);

create policy "class_types_admin_write"
  on class_types for insert
  with check (public.is_admin());

create policy "class_types_admin_update"
  on class_types for update
  using (public.is_admin());

alter table classes enable row level security;

create policy "classes_select_authenticated"
  on classes for select
  to authenticated
  using (true);

create policy "classes_admin_write"
  on classes for insert
  with check (public.is_admin());

create policy "classes_admin_update"
  on classes for update
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- class_bookings — members manage only their own booking rows; admins see
-- and manage all. (class_capacity_view, defined in the schema migration,
-- is how members see aggregate seat counts without this policy needing to
-- expose other members' rows.)
-- ---------------------------------------------------------------------------
alter table class_bookings enable row level security;

create policy "class_bookings_select_own_or_admin"
  on class_bookings for select
  using (member_id = auth.uid() or public.is_admin());

create policy "class_bookings_insert_own_or_admin"
  on class_bookings for insert
  with check (member_id = auth.uid() or public.is_admin());

create policy "class_bookings_update_own_or_admin"
  on class_bookings for update
  using (member_id = auth.uid() or public.is_admin());

grant select on class_capacity_view to authenticated;

-- ---------------------------------------------------------------------------
-- trainer_sessions — member can request/view their own; admin manages all
-- ---------------------------------------------------------------------------
alter table trainer_sessions enable row level security;

create policy "trainer_sessions_select_own_or_admin"
  on trainer_sessions for select
  using (member_id = auth.uid() or public.is_admin());

create policy "trainer_sessions_insert_own_or_admin"
  on trainer_sessions for insert
  with check (member_id = auth.uid() or public.is_admin());

create policy "trainer_sessions_update_own_or_admin"
  on trainer_sessions for update
  using (member_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- diet_plans / workout_plans — member reads their own; admin authors all
-- ---------------------------------------------------------------------------
alter table diet_plans enable row level security;

create policy "diet_plans_select_own_or_admin"
  on diet_plans for select
  using (member_id = auth.uid() or public.is_admin());

create policy "diet_plans_admin_write"
  on diet_plans for insert
  with check (public.is_admin());

create policy "diet_plans_admin_update"
  on diet_plans for update
  using (public.is_admin());

alter table workout_plans enable row level security;

create policy "workout_plans_select_own_or_admin"
  on workout_plans for select
  using (member_id = auth.uid() or public.is_admin());

create policy "workout_plans_admin_write"
  on workout_plans for insert
  with check (public.is_admin());

create policy "workout_plans_admin_update"
  on workout_plans for update
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- workout_logs — member's own self-logged data; admin can view all, nobody
-- but the member (or admin) can write it
-- ---------------------------------------------------------------------------
alter table workout_logs enable row level security;

create policy "workout_logs_select_own_or_admin"
  on workout_logs for select
  using (member_id = auth.uid() or public.is_admin());

create policy "workout_logs_insert_own_or_admin"
  on workout_logs for insert
  with check (member_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- announcements — readable by all signed-in users, writable by admin only
-- ---------------------------------------------------------------------------
alter table announcements enable row level security;

create policy "announcements_select_authenticated"
  on announcements for select
  to authenticated
  using (true);

create policy "announcements_admin_write"
  on announcements for insert
  with check (public.is_admin());
