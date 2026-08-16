-- PowerHealth: table-level privilege grants for the `authenticated` role
--
-- RLS policies (0002) define *which rows* a role can touch, but Postgres
-- also requires a table-level GRANT before RLS is even evaluated. Supabase's
-- dashboard normally issues these automatically via an "expose new tables"
-- event trigger, but that's intentionally off for this project (so nothing
-- is exposed by default), and migrations run via the CLI don't get it
-- either — so grants must be explicit here.
--
-- Every table in this schema requires authentication to read or write, so
-- privileges go to `authenticated` only. `anon` gets nothing: there is no
-- public/unauthenticated read surface in this app by design.

grant usage on schema public to authenticated;

grant select, insert, update on
  public.profiles,
  public.memberships,
  public.bmi_records,
  public.class_types,
  public.classes,
  public.class_bookings,
  public.trainer_sessions,
  public.diet_plans,
  public.workout_plans,
  public.announcements
to authenticated;

-- workout_logs only has select/insert RLS policies (members don't edit past
-- log entries), so no update grant here.
grant select, insert on public.workout_logs to authenticated;
