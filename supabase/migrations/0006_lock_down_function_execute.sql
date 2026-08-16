-- PowerHealth: revoke the default PUBLIC execute grant on custom functions
--
-- Postgres grants EXECUTE to the PUBLIC pseudo-role on every function by
-- default at creation time. None of the previous migrations revoked it, so
-- every function below was callable via PostgREST RPC by anyone, including
-- unauthenticated (anon) requests — confirmed live: `delete_own_account`
-- returned 204 to a plain anon-key call. Each one happened to be safe in
-- practice (auth.uid() is null for anon, so delete_own_account and the
-- is_admin() check inside admin_refresh_membership_statuses both no-op),
-- but that safety was incidental, not something the grants enforced. This
-- makes the intended access explicit instead of relying on that.

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- No grant to authenticated/anon: only pg_cron (as the function owner) and
-- admin_refresh_membership_statuses() (security definer) should call this.
revoke execute on function public.refresh_membership_statuses() from public;

revoke execute on function public.admin_refresh_membership_statuses() from public;
grant execute on function public.admin_refresh_membership_statuses() to authenticated;

revoke execute on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
