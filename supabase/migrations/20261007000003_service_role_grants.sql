-- The server (service_role) must be able to use every table. Hosted Supabase projects do not grant this
-- automatically to tables created by migrations, and migration 1 revoked broad grants from anon/authenticated.
-- anon/authenticated keep their narrow, RLS-protected grants from migration 1; nothing here widens those.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
