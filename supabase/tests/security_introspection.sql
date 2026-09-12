-- Contrôles non destructifs après installation de la migration V3.

-- 1. RLS doit être active sur toutes les tables métier sensibles.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('profiles','training_requests','carpool_posts','conversations','messages','blocks','reports')
order by c.relname;

-- 2. Inventaire des politiques.
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles','training_requests','carpool_posts','conversations','messages','blocks','reports')
order by tablename, policyname;

-- 3. Fonctions de sécurité attendues.
select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('start_conversation','hide_conversation','search_carpool_offers','is_pair_blocked');

-- 4. Realtime doit contenir messages.
select pubname, schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages';
