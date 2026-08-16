-- PowerHealth: keep membership statuses fresh without manual intervention
--
-- refresh_membership_statuses() (0001) only runs on-demand. This schedules
-- it daily via pg_cron, and adds an admin-only RPC wrapper for a manual
-- "Refresh now" button as a belt-and-suspenders option.

create extension if not exists pg_cron with schema extensions;

-- 18:45 UTC = 00:15 IST (Gaur City, Greater Noida is UTC+5:30) — just after
-- local midnight, so a member's status reflects "today" as early as possible.
select cron.schedule(
  'refresh-membership-statuses-daily',
  '45 18 * * *',
  $$ select public.refresh_membership_statuses(); $$
);

-- refresh_membership_statuses() itself has no auth check (pg_cron calls it
-- outside of any user session, so auth.uid() would be null and any is_admin()
-- check would break the scheduled job). This wrapper is what the admin
-- dashboard's manual "Refresh now" button calls instead — it enforces
-- admin-only at the database level regardless of what a client sends.
create function public.admin_refresh_membership_statuses()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  perform public.refresh_membership_statuses();
end;
$$;

grant execute on function public.admin_refresh_membership_statuses() to authenticated;
