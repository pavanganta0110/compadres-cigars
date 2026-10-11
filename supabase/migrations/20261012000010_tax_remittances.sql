-- Sales tax remittance ledger. The system TRACKS payments staff make in each state's tax portal; it never moves money.
-- Rows are append-only: the only allowed change is voiding a mistaken entry (voided_at/voided_by).
create table tax_remittances (
  id uuid primary key default gen_random_uuid(),
  state char(2) not null references tax_rates(state),
  period_from date not null,
  period_to date not null,
  amount_cents int not null check (amount_cents > 0),
  paid_on date not null,
  method text check (method is null or method in ('state_portal','ach','check','other')),
  confirmation text check (confirmation is null or length(confirmation) <= 120),
  note text check (note is null or length(note) <= 500),
  created_by uuid,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid,
  check (period_to >= period_from)
);
create index tax_remittances_state_idx on tax_remittances(state, paid_on desc);

alter table tax_remittances enable row level security;
revoke all on tax_remittances from anon, authenticated;
grant select, insert, update on tax_remittances to service_role;

create or replace function guard_tax_remittance() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'tax_remittances is append-only'; end if;
  if old.voided_at is not null then raise exception 'a voided remittance cannot change'; end if;
  if (to_jsonb(new) - 'voided_at' - 'voided_by') is distinct from (to_jsonb(old) - 'voided_at' - 'voided_by') then
    raise exception 'tax_remittances is append-only (only voiding is allowed)';
  end if;
  return new;
end $$;
create trigger tax_remittances_guard before update or delete on tax_remittances for each row execute function guard_tax_remittance();

create or replace function audit_tax_remittance() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into audit_log(actor, action, entity, entity_id, detail)
    values (coalesce(new.created_by::text, 'system'), 'tax.remittance_recorded', 'tax_remittances', new.id::text,
            jsonb_build_object('state', new.state, 'amount_cents', new.amount_cents, 'paid_on', new.paid_on, 'period_from', new.period_from, 'period_to', new.period_to));
  elsif new.voided_at is not null and old.voided_at is null then
    insert into audit_log(actor, action, entity, entity_id, detail)
    values (coalesce(new.voided_by::text, 'system'), 'tax.remittance_voided', 'tax_remittances', new.id::text,
            jsonb_build_object('state', new.state, 'amount_cents', new.amount_cents));
  end if;
  return new;
end $$;
create trigger tax_remittances_audit after insert or update on tax_remittances for each row execute function audit_tax_remittance();
