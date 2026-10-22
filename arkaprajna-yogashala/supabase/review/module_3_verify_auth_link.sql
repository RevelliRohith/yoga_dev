-- READ ONLY. Run this separately in Supabase SQL Editor.
-- Returns schema definitions and aggregate counts only: no user rows/credentials.
begin read only;

-- A positive FK result requires the exact profiles.id -> auth.users.id mapping.
with exact_fk as (
  select con.oid, con.convalidated
  from pg_constraint con
  where con.contype = 'f'
    and con.conrelid = 'public.profiles'::regclass
    and con.confrelid = 'auth.users'::regclass
    and con.conkey = array[
      (select attnum from pg_attribute
       where attrelid = 'public.profiles'::regclass and attname = 'id' and not attisdropped)
    ]::smallint[]
    and con.confkey = array[
      (select attnum from pg_attribute
       where attrelid = 'auth.users'::regclass and attname = 'id' and not attisdropped)
    ]::smallint[]
)
select
  exists(select 1 from exact_fk) as exact_auth_foreign_key_exists,
  exists(select 1 from exact_fk where convalidated) as exact_auth_foreign_key_validated,
  (select count(*) from pg_trigger
   where tgrelid = 'auth.users'::regclass and not tgisinternal
     and (tgtype::integer & 4) = 4) as auth_insert_trigger_count,
  (select count(*) from public.profiles p
   where not exists(select 1 from auth.users u where u.id = p.id)) as profiles_without_matching_auth_user;

-- Show every profile FK, including validation and deletion behavior.
select con.conname as constraint_name, con.convalidated as validated,
       con.confrelid::regclass::text as referenced_table,
       pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
where con.conrelid = 'public.profiles'::regclass and con.contype = 'f'
order by con.conname;

-- Show Auth INSERT triggers explicitly. An empty grid means none were found.
-- tgenabled: O = origin/default, D = disabled, R = replica, A = always.
select trg.tgname as trigger_name, trg.tgenabled as enabled_mode,
       pg_get_triggerdef(trg.oid, true) as trigger_definition,
       ns.nspname as function_schema, fn.proname as function_name,
       fn.prosecdef as security_definer, fn.proconfig as function_settings,
       pg_get_functiondef(fn.oid) as function_definition
from pg_trigger trg
join pg_proc fn on fn.oid = trg.tgfoid
join pg_namespace ns on ns.oid = fn.pronamespace
where trg.tgrelid = 'auth.users'::regclass and not trg.tgisinternal
  and (trg.tgtype::integer & 4) = 4
order by trg.tgname;

rollback;
