-- KizConnect V3.4 — Connexion training mutuelle
-- À exécuter UNE SEULE FOIS après 001 et 002.
-- Principe : aucun intérêt reçu non réciproque n'est lisible par le destinataire.

alter table public.profiles
  add column if not exists training_match_enabled boolean not null default false;

create table if not exists public.training_interests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint training_interest_not_self check (from_user_id <> to_user_id),
  unique(from_user_id, to_user_id)
);

create index if not exists training_interests_from_idx
  on public.training_interests(from_user_id, created_at desc);
create index if not exists training_interests_to_idx
  on public.training_interests(to_user_id, created_at desc);

alter table public.training_interests enable row level security;

-- L'utilisateur ne peut relire que les intérêts qu'il a envoyés.
-- Les intérêts reçus restent invisibles tant qu'ils ne sont pas mutuels.
drop policy if exists training_interests_outgoing_read on public.training_interests;
create policy training_interests_outgoing_read
on public.training_interests for select
to authenticated
using (from_user_id = auth.uid());

revoke all on public.training_interests from anon, authenticated;
grant select on public.training_interests to authenticated;

-- Toute désactivation de la fonction efface les intérêts liés au compte.
create or replace function public.clear_training_interests_on_optout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.training_match_enabled = true and new.training_match_enabled = false then
    delete from public.training_interests
    where from_user_id = new.id or to_user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists clear_training_interests_on_optout on public.profiles;
create trigger clear_training_interests_on_optout
after update of training_match_enabled on public.profiles
for each row execute function public.clear_training_interests_on_optout();

-- Un blocage annule les intérêts dans les deux sens pour éviter qu'un ancien match réapparaisse.
create or replace function public.clear_training_interests_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.training_interests
  where (from_user_id = new.blocker_id and to_user_id = new.blocked_user_id)
     or (from_user_id = new.blocked_user_id and to_user_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists clear_training_interests_on_block on public.blocks;
create trigger clear_training_interests_on_block
after insert on public.blocks
for each row execute function public.clear_training_interests_on_block();

create or replace function public.set_training_interest(
  target_user uuid,
  active boolean default true
)
returns table(matched boolean, target_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  my_enabled boolean;
  target_enabled boolean;
  target_visible boolean;
begin
  if me is null then
    raise exception 'authentication required';
  end if;
  if target_user is null or target_user = me then
    raise exception 'invalid target';
  end if;

  -- Retirer son propre intérêt doit toujours être possible.
  if not active then
    delete from public.training_interests
    where from_user_id = me and to_user_id = target_user;

    select display_name into target_name
    from public.profiles where id = target_user;

    matched := false;
    return next;
    return;
  end if;

  select training_match_enabled
  into my_enabled
  from public.profiles
  where id = me;

  if coalesce(my_enabled, false) = false then
    raise exception 'training match disabled';
  end if;

  select training_match_enabled, is_visible, display_name
  into target_enabled, target_visible, target_name
  from public.profiles
  where id = target_user;

  if not found or coalesce(target_enabled, false) = false or coalesce(target_visible, false) = false then
    raise exception 'target unavailable';
  end if;

  if public.is_pair_blocked(me, target_user) then
    raise exception 'pair blocked';
  end if;

  insert into public.training_interests(from_user_id, to_user_id)
  values (me, target_user)
  on conflict (from_user_id, to_user_id) do nothing;

  select exists (
    select 1
    from public.training_interests reverse_interest
    where reverse_interest.from_user_id = target_user
      and reverse_interest.to_user_id = me
  )
  into matched;

  return next;
end;
$$;

revoke all on function public.set_training_interest(uuid, boolean) from public;
grant execute on function public.set_training_interest(uuid, boolean) to authenticated;

create or replace function public.list_training_matches()
returns table(
  id uuid,
  display_name text,
  city text,
  level text,
  styles text[],
  bio text,
  avatar_url text,
  matched_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.display_name,
    p.city,
    p.level,
    p.styles,
    p.bio,
    p.avatar_url,
    greatest(outgoing.created_at, incoming.created_at) as matched_at
  from public.training_interests outgoing
  join public.training_interests incoming
    on incoming.from_user_id = outgoing.to_user_id
   and incoming.to_user_id = outgoing.from_user_id
  join public.profiles p
    on p.id = outgoing.to_user_id
  where outgoing.from_user_id = auth.uid()
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.training_match_enabled = true
    )
    and p.is_visible = true
    and p.training_match_enabled = true
    and not public.is_pair_blocked(auth.uid(), p.id)
  order by greatest(outgoing.created_at, incoming.created_at) desc;
$$;

revoke all on function public.list_training_matches() from public;
grant execute on function public.list_training_matches() to authenticated;
