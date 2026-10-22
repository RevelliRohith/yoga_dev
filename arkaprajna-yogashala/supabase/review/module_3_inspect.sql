-- READ ONLY: run in Supabase SQL Editor. No user records or credentials are read.
-- Share result grids, not database connection strings, Auth rows, or secret keys.
begin read only;

-- Column contracts, including existing trainer fields and student assignment keys.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('profiles', 'programs', 'batches', 'students')
order by table_name, ordinal_position;

-- Primary keys, foreign keys (including profiles -> auth.users), and checks.
select ns.nspname as schema_name, rel.relname as table_name, con.conname,
       con.contype, pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace ns on ns.oid = rel.relnamespace
where ns.nspname = 'public' and rel.relname in ('profiles', 'programs', 'batches', 'students')
order by rel.relname, con.conname;

-- All public tables: identify any fee/payment/private tables already present.
select tablename, rowsecurity, hasindexes
from pg_tables where schemaname = 'public' order by tablename;

-- Existing policies must be reviewed before adding/replacing any access rules.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- Table and column grants can bypass intended column-level privacy boundaries.
select table_schema, table_name, grantee, privilege_type
from information_schema.table_privileges
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, grantee, privilege_type;

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('profiles', 'programs', 'batches', 'students')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
order by table_name, column_name, grantee, privilege_type;

-- Existing Auth/profile triggers: definition only, never Auth user records.
select ns.nspname as table_schema, rel.relname as table_name, trg.tgname,
       pg_get_triggerdef(trg.oid, true) as trigger_definition,
       fn_ns.nspname as function_schema, fn.proname as function_name,
       pg_get_functiondef(fn.oid) as function_definition
from pg_trigger trg
join pg_class rel on rel.oid = trg.tgrelid
join pg_namespace ns on ns.oid = rel.relnamespace
join pg_proc fn on fn.oid = trg.tgfoid
join pg_namespace fn_ns on fn_ns.oid = fn.pronamespace
where not trg.tgisinternal
  and ((ns.nspname = 'auth' and rel.relname = 'users')
    or (ns.nspname = 'public' and rel.relname = 'profiles'))
order by ns.nspname, rel.relname, trg.tgname;

-- Role helpers/security-definer RPCs may also affect access.
select ns.nspname as schema_name, fn.proname,
       pg_get_function_identity_arguments(fn.oid) as arguments,
       fn.prosecdef as security_definer
from pg_proc fn join pg_namespace ns on ns.oid = fn.pronamespace
where ns.nspname in ('public', 'private') order by ns.nspname, fn.proname;

-- Storage bucket configuration only; never list stored objects.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets order by id;

rollback;
