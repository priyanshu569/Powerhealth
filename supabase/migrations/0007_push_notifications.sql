-- PowerHealth: push notifications for new announcements and class reminders
--
-- Sent directly from Postgres via pg_net — no Edge Function or separate
-- backend, consistent with how membership refresh (pg_cron) and account
-- deletion were implemented. A trigger fires Expo pushes on new
-- announcements; a pg_cron job checks every 10 minutes for classes
-- starting soon and pushes members who booked them.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- push_tokens: one row per (member, device) — a member may have several
-- devices registered at once.
-- ---------------------------------------------------------------------------
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, token)
);

create index push_tokens_member_id_idx on push_tokens (member_id);

alter table push_tokens enable row level security;

create policy "push_tokens_select_own"
  on push_tokens for select
  using (member_id = auth.uid());

create policy "push_tokens_insert_own"
  on push_tokens for insert
  with check (member_id = auth.uid());

create policy "push_tokens_update_own"
  on push_tokens for update
  using (member_id = auth.uid());

create policy "push_tokens_delete_own"
  on push_tokens for delete
  using (member_id = auth.uid());

grant select, insert, update, delete on public.push_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- send_expo_push_notifications: shared helper, chunked to Expo's 100-
-- message-per-request limit. Internal only, not meant to be called by any
-- client directly (see 0006 for why every custom function needs this).
-- ---------------------------------------------------------------------------
create function public.send_expo_push_notifications(
  p_tokens text[],
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  chunk text[];
  messages jsonb;
  i int;
begin
  if p_tokens is null or array_length(p_tokens, 1) is null then
    return;
  end if;

  for i in 0 .. (array_length(p_tokens, 1) - 1) / 100 loop
    chunk := p_tokens[i * 100 + 1 : i * 100 + 100];
    select jsonb_agg(jsonb_build_object('to', t, 'title', p_title, 'body', p_body, 'data', p_data))
    into messages
    from unnest(chunk) as t;

    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := messages
    );
  end loop;
end;
$$;

revoke execute on function public.send_expo_push_notifications(text[], text, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- New announcement -> push every member
-- ---------------------------------------------------------------------------
create function public.notify_new_announcement()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  tokens text[];
begin
  select array_agg(distinct pt.token) into tokens
  from push_tokens pt
  join profiles p on p.id = pt.member_id
  where p.role = 'member';

  perform public.send_expo_push_notifications(tokens, new.title, left(new.body, 150));
  return new;
end;
$$;

revoke execute on function public.notify_new_announcement() from public;

create trigger on_announcement_created
  after insert on announcements
  for each row execute procedure public.notify_new_announcement();

-- ---------------------------------------------------------------------------
-- Class reminders: pg_cron checks every 10 minutes for classes starting in
-- 20-30 minutes and pushes members with a 'booked' (not waitlisted) status.
-- class_reminder_log de-dupes so a weekly-recurring class's *this week's*
-- occurrence is only reminded once, while still reminding again next week.
-- ---------------------------------------------------------------------------
create table class_reminder_log (
  class_id uuid not null references classes (id) on delete cascade,
  occurrence_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (class_id, occurrence_at)
);

create function public.send_class_reminders()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  rec record;
  tokens text[];
  ist_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  -- ist_today anchors "today" and day-of-week math to gym-local time
  -- (Asia/Kolkata) rather than the database session's timezone, since the
  -- two can disagree on the calendar date for part of the day otherwise.
  for rec in
    select
      c.id as class_id,
      coalesce(c.title, ct.name) as display_name,
      c.trainer_name,
      (
        (
          case
            when c.recurrence = 'once' then c.session_date
            else ist_today + ((c.day_of_week - extract(dow from ist_today)::int + 7) % 7)
          end
        )::timestamp + c.start_time
      ) at time zone 'Asia/Kolkata' as occurrence_utc
    from classes c
    join class_types ct on ct.id = c.class_type_id
    where c.is_active
  loop
    if rec.occurrence_utc is null then
      continue;
    end if;

    if rec.occurrence_utc between now() + interval '20 minutes' and now() + interval '30 minutes' then
      insert into class_reminder_log (class_id, occurrence_at)
      values (rec.class_id, rec.occurrence_utc)
      on conflict do nothing;

      if found then
        select array_agg(distinct pt.token) into tokens
        from class_bookings cb
        join push_tokens pt on pt.member_id = cb.member_id
        where cb.class_id = rec.class_id and cb.status = 'booked';

        if tokens is not null then
          perform public.send_expo_push_notifications(
            tokens,
            'Class starting soon',
            rec.display_name || ' with ' || coalesce(rec.trainer_name, 'your trainer') || ' starts in about 30 minutes'
          );
        end if;
      end if;
    end if;
  end loop;
end;
$$;

revoke execute on function public.send_class_reminders() from public;

select cron.schedule(
  'send-class-reminders',
  '*/10 * * * *',
  $$ select public.send_class_reminders(); $$
);
