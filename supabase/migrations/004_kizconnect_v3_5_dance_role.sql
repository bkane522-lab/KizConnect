-- KizConnect V3.5 — rôle de danse Leader / Follower / Les deux
-- À exécuter UNE SEULE FOIS après 001, 002 et 003.

alter table public.profiles
  add column if not exists dance_role text;

alter table public.profiles
  drop constraint if exists profiles_valid_dance_role;

alter table public.profiles
  add constraint profiles_valid_dance_role
  check (dance_role is null or dance_role in ('Leader','Follower','Les deux'));

create index if not exists profiles_dance_role_idx
  on public.profiles(dance_role)
  where dance_role is not null;

comment on column public.profiles.dance_role is
  'Rôle de danse facultatif : Leader, Follower ou Les deux. Indépendant du genre.';
