-- PowerHealth: self-service account deletion (Apple App Store guideline
-- 5.1.1(v) — apps that support account creation must also support deletion,
-- initiated in-app, not via a phone call/email/website).
--
-- Every table in this schema references profiles(id) on delete cascade, and
-- profiles references auth.users(id) on delete cascade (see 0001) — so
-- deleting the auth.users row alone removes all of a member's data
-- (memberships, BMI history, bookings, plans, workout logs, trainer
-- sessions) in one atomic transaction. No Edge Function or service-role key
-- needed: security definer gives this function the privileges to touch
-- auth.users directly, and `where id = auth.uid()` scopes it to only ever
-- delete the caller's own row, regardless of what a client sends.
create function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_own_account() to authenticated;
