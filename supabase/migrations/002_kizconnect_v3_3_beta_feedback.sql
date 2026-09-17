-- KizConnect V3.3 — retours bêta
-- À exécuter UNE SEULE FOIS après 001_kizconnect_v3.sql.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('ux','bug','idea','other')),
  message text not null check (char_length(btrim(message)) between 3 and 1000),
  app_version text not null default '3.3.0' check (char_length(app_version) <= 30),
  created_at timestamptz not null default now()
);

create index if not exists beta_feedback_user_created_idx
  on public.beta_feedback(user_id, created_at desc);

alter table public.beta_feedback enable row level security;

revoke all on public.beta_feedback from anon, authenticated;
grant select on public.beta_feedback to authenticated;

create policy "beta_feedback_select_own"
on public.beta_feedback for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.submit_beta_feedback(
  feedback_category text,
  feedback_message text,
  feedback_version text default '3.3.0'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  if feedback_category not in ('ux','bug','idea','other') then raise exception 'invalid category'; end if;
  if char_length(btrim(coalesce(feedback_message, ''))) not between 3 and 1000 then raise exception 'invalid message'; end if;
  if exists (
    select 1 from public.beta_feedback
    where user_id = me and created_at > now() - interval '45 seconds'
  ) then
    raise exception 'feedback rate limited';
  end if;

  insert into public.beta_feedback(user_id, category, message, app_version)
  values (me, feedback_category, btrim(feedback_message), left(coalesce(nullif(feedback_version, ''), '3.3.0'), 30))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.submit_beta_feedback(text, text, text) from public;
grant execute on function public.submit_beta_feedback(text, text, text) to authenticated;
