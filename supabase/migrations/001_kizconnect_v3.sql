-- KizConnect V3 — bêta fonctionnelle
-- Projet neuf : exécuter ce fichier une seule fois dans Supabase SQL Editor.
-- Aucune clé service_role n'est nécessaire dans le frontend.

create extension if not exists pgcrypto;

-- =========================
-- TABLES MÉTIER
-- =========================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  city text not null default '' check (char_length(city) <= 80),
  level text check (level is null or level in ('Débutant','Intermédiaire','Avancé')),
  styles text[] not null default '{}',
  bio text check (bio is null or char_length(bio) <= 500),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 1000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_valid_styles check (styles <@ array['Kizomba','Urban Kiz','Semba','Tarraxo','Tarraxinha']::text[])
);

create table if not exists public.training_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  city text not null check (char_length(btrim(city)) between 1 and 80),
  event_date date not null,
  event_time time,
  style text not null check (style in ('Kizomba','Urban Kiz','Semba','Tarraxo','Tarraxinha')),
  level text not null check (level in ('Débutant','Intermédiaire','Avancé')),
  note text check (note is null or char_length(note) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists training_requests_date_idx on public.training_requests(event_date, event_time);
create index if not exists training_requests_owner_created_idx on public.training_requests(owner_id, created_at desc);

create table if not exists public.carpool_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer','seek')),
  from_city text not null check (char_length(btrim(from_city)) between 1 and 100),
  destination text not null check (char_length(btrim(destination)) between 1 and 120),
  event_name text check (event_name is null or char_length(event_name) <= 120),
  travel_date date not null,
  travel_time time,
  people_count smallint check (people_count is null or people_count between 1 and 8),
  seats_available smallint check (seats_available is null or seats_available between 1 and 8),
  contribution numeric(7,2) check (contribution is null or contribution between 0 and 999),
  note text check (note is null or char_length(note) <= 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint carpool_offer_fields check (kind <> 'offer' or seats_available is not null),
  constraint carpool_seek_fields check (kind <> 'seek' or people_count is not null)
);

create index if not exists carpool_posts_date_idx on public.carpool_posts(travel_date, travel_time);
create index if not exists carpool_posts_owner_created_idx on public.carpool_posts(owner_id, created_at desc);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null references public.profiles(id) on delete cascade,
  participant_b uuid not null references public.profiles(id) on delete cascade,
  participant_a_hidden boolean not null default false,
  participant_b_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversation_two_people check (participant_a <> participant_b)
);

create unique index if not exists conversations_pair_unique
  on public.conversations (least(participant_a, participant_b), greatest(participant_a, participant_b));
create index if not exists conversations_updated_idx on public.conversations(updated_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1500),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists messages_sender_created_idx on public.messages(sender_id, created_at desc);

create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint block_not_self check (blocker_id <> blocked_user_id),
  unique(blocker_id, blocked_user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('harassment','spam','fake_profile','unsafe','other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz not null default now(),
  constraint report_not_self check (reporter_id <> reported_user_id)
);

create index if not exists reports_reporter_created_idx on public.reports(reporter_id, created_at desc);

-- =========================
-- PROFIL AUTOMATIQUE
-- =========================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, city)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), 'Danseur'), 50),
    left(coalesce(btrim(new.raw_user_meta_data->>'city'), ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- =========================
-- HELPERS SÉCURISÉS
-- =========================

create or replace function public.is_pair_blocked(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or auth.uid() not in (user_a, user_b) then false
    else exists (
      select 1 from public.blocks
      where (blocker_id = user_a and blocked_user_id = user_b)
         or (blocker_id = user_b and blocked_user_id = user_a)
    )
  end;
$$;
revoke all on function public.is_pair_blocked(uuid, uuid) from public;
grant execute on function public.is_pair_blocked(uuid, uuid) to authenticated;

-- Ouvre ou récupère une conversation. L'identité vient exclusivement de auth.uid().
create or replace function public.start_conversation(other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_id uuid;
begin
  if me is null then raise exception 'authentication required'; end if;
  if other_user is null or other_user = me then raise exception 'invalid recipient'; end if;
  if not exists (select 1 from public.profiles where id = other_user and is_visible = true) then
    raise exception 'recipient unavailable';
  end if;
  if public.is_pair_blocked(me, other_user) then raise exception 'conversation blocked'; end if;

  select id into conv_id
  from public.conversations
  where (participant_a = me and participant_b = other_user)
     or (participant_a = other_user and participant_b = me)
  limit 1;

  if conv_id is null then
    insert into public.conversations(participant_a, participant_b)
    values (me, other_user)
    returning id into conv_id;
  else
    update public.conversations
    set participant_a_hidden = case when participant_a = me then false else participant_a_hidden end,
        participant_b_hidden = case when participant_b = me then false else participant_b_hidden end
    where id = conv_id;
  end if;

  return conv_id;
end;
$$;
revoke all on function public.start_conversation(uuid) from public;
grant execute on function public.start_conversation(uuid) to authenticated;

-- Masque une conversation uniquement pour la personne connectée.
create or replace function public.hide_conversation(conversation_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'authentication required'; end if;

  update public.conversations
  set participant_a_hidden = case when participant_a = me then true else participant_a_hidden end,
      participant_b_hidden = case when participant_b = me then true else participant_b_hidden end
  where id = conversation_uuid
    and me in (participant_a, participant_b);

  if not found then raise exception 'conversation unavailable'; end if;
end;
$$;
revoke all on function public.hide_conversation(uuid) from public;
grant execute on function public.hide_conversation(uuid) to authenticated;

-- Recherche de covoiturage paramétrée : pas de filtre PostgREST construit depuis du texte utilisateur.
create or replace function public.search_carpool_offers(
  q_from text default null,
  q_destination text default null,
  q_date date default null,
  q_people integer default 1
)
returns table (
  id uuid,
  owner_id uuid,
  from_city text,
  destination text,
  event_name text,
  travel_date date,
  travel_time time,
  seats_available smallint,
  contribution numeric,
  note text,
  owner_display_name text,
  owner_avatar_url text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.owner_id, c.from_city, c.destination, c.event_name, c.travel_date,
    c.travel_time, c.seats_available, c.contribution, c.note,
    p.display_name as owner_display_name, p.avatar_url as owner_avatar_url
  from public.carpool_posts c
  join public.profiles p on p.id = c.owner_id
  where c.kind = 'offer'
    and c.is_active = true
    and c.travel_date >= current_date
    and (nullif(btrim(q_from), '') is null or c.from_city ilike '%' || btrim(q_from) || '%')
    and (
      nullif(btrim(q_destination), '') is null
      or c.destination ilike '%' || btrim(q_destination) || '%'
      or coalesce(c.event_name, '') ilike '%' || btrim(q_destination) || '%'
    )
    and (q_date is null or c.travel_date = q_date)
    and c.seats_available >= greatest(1, least(coalesce(q_people, 1), 8))
  order by c.travel_date asc, c.travel_time asc nulls last
  limit 50;
$$;
revoke all on function public.search_carpool_offers(text, text, date, integer) from public;
grant execute on function public.search_carpool_offers(text, text, date, integer) to anon, authenticated;

-- =========================
-- GARDES ANTI-ABUS DE BASE
-- =========================

create or replace function public.guard_listing_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null or new.owner_id <> auth.uid() then raise exception 'invalid owner'; end if;

  if tg_table_name = 'training_requests' then
    if new.event_date < current_date then raise exception 'past_date'; end if;
    select count(*) into recent_count from public.training_requests
      where owner_id = new.owner_id and created_at > now() - interval '10 minutes';
  elsif tg_table_name = 'carpool_posts' then
    if new.travel_date < current_date then raise exception 'past_date'; end if;
    select count(*) into recent_count from public.carpool_posts
      where owner_id = new.owner_id and created_at > now() - interval '10 minutes';
  else
    return new;
  end if;

  if recent_count >= 5 then raise exception 'rate_limit_listing'; end if;
  return new;
end;
$$;

drop trigger if exists guard_training_insert on public.training_requests;
create trigger guard_training_insert before insert on public.training_requests
for each row execute procedure public.guard_listing_insert();

drop trigger if exists guard_carpool_insert on public.carpool_posts;
create trigger guard_carpool_insert before insert on public.carpool_posts
for each row execute procedure public.guard_listing_insert();

create or replace function public.guard_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null or new.sender_id <> auth.uid() then raise exception 'invalid sender'; end if;
  select count(*) into recent_count
  from public.messages
  where sender_id = new.sender_id and created_at > now() - interval '1 minute';
  if recent_count >= 30 then raise exception 'rate_limit_message'; end if;
  return new;
end;
$$;

drop trigger if exists guard_message_insert on public.messages;
create trigger guard_message_insert before insert on public.messages
for each row execute procedure public.guard_message_insert();

-- Un nouveau message remet la conversation dans les listes des deux participants.
create or replace function public.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now(), participant_a_hidden = false, participant_b_hidden = false
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation_after_message on public.messages;
create trigger touch_conversation_after_message after insert on public.messages
for each row execute procedure public.touch_conversation();

-- =========================
-- ROW LEVEL SECURITY
-- =========================

alter table public.profiles enable row level security;
alter table public.training_requests enable row level security;
alter table public.carpool_posts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Profils : lecture de profils visibles ; chaque personne modifie uniquement son profil.
drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles
for select using (is_visible = true or auth.uid() = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Training : actif = lisible ; propriétaire seul pour écrire/modifier/supprimer.
drop policy if exists training_public_read on public.training_requests;
create policy training_public_read on public.training_requests
for select using (is_active = true or auth.uid() = owner_id);

drop policy if exists training_owner_insert on public.training_requests;
create policy training_owner_insert on public.training_requests
for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists training_owner_update on public.training_requests;
create policy training_owner_update on public.training_requests
for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists training_owner_delete on public.training_requests;
create policy training_owner_delete on public.training_requests
for delete to authenticated using (auth.uid() = owner_id);

-- Covoiturage : mêmes règles.
drop policy if exists carpool_public_read on public.carpool_posts;
create policy carpool_public_read on public.carpool_posts
for select using (is_active = true or auth.uid() = owner_id);

drop policy if exists carpool_owner_insert on public.carpool_posts;
create policy carpool_owner_insert on public.carpool_posts
for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists carpool_owner_update on public.carpool_posts;
create policy carpool_owner_update on public.carpool_posts
for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists carpool_owner_delete on public.carpool_posts;
create policy carpool_owner_delete on public.carpool_posts
for delete to authenticated using (auth.uid() = owner_id);

-- Conversations : lecture uniquement par les deux participants. Création/masquage via RPC.
drop policy if exists conversations_member_read on public.conversations;
create policy conversations_member_read on public.conversations
for select to authenticated using (auth.uid() in (participant_a, participant_b));

-- Messages : lecture par les participants ; envoi seulement par soi et si aucun blocage n'existe.
drop policy if exists messages_member_read on public.messages;
create policy messages_member_read on public.messages
for select to authenticated using (
  exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and auth.uid() in (c.participant_a, c.participant_b)
  )
);

drop policy if exists messages_member_insert on public.messages;
create policy messages_member_insert on public.messages
for insert to authenticated with check (
  sender_id = auth.uid()
  and exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id
      and auth.uid() in (c.participant_a, c.participant_b)
      and not public.is_pair_blocked(c.participant_a, c.participant_b)
  )
);

-- Blocages : seul le bloqueur consulte et gère sa liste.
drop policy if exists blocks_self_read on public.blocks;
create policy blocks_self_read on public.blocks
for select to authenticated using (blocker_id = auth.uid());

drop policy if exists blocks_self_insert on public.blocks;
create policy blocks_self_insert on public.blocks
for insert to authenticated with check (blocker_id = auth.uid());

drop policy if exists blocks_self_delete on public.blocks;
create policy blocks_self_delete on public.blocks
for delete to authenticated using (blocker_id = auth.uid());

-- Signalements : le reporter crée et relit uniquement ses propres signalements.
drop policy if exists reports_self_insert on public.reports;
create policy reports_self_insert on public.reports
for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists reports_self_read on public.reports;
create policy reports_self_read on public.reports
for select to authenticated using (reporter_id = auth.uid());

-- =========================
-- STORAGE : AVATARS PUBLICS, ÉCRITURE PERSONNELLE
-- =========================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
for select using (bucket_id = 'avatars');

drop policy if exists avatars_self_insert on storage.objects;
create policy avatars_self_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_self_update on storage.objects;
create policy avatars_self_update on storage.objects
for update to authenticated using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists avatars_self_delete on storage.objects;
create policy avatars_self_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- =========================
-- GRANTS
-- =========================

grant select on public.profiles, public.training_requests, public.carpool_posts to anon, authenticated;
grant update on public.profiles to authenticated;
grant insert, update, delete on public.training_requests, public.carpool_posts to authenticated;
grant select on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert on public.reports to authenticated;

-- Realtime sur les nouveaux messages. Le bloc DO évite une erreur si le script est relancé.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
