-- Brand royalties: a rate history per brand (so a rate change never rewrites past sales) and a payout ledger.
-- Royalties are a percentage of NET product sales (item subtotal; no tax, no shipping; refunds reduce it).
-- This records what is owed and what has been paid. It does not move money.

create table brand_royalty_rates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  rate_bps int not null check (rate_bps between 0 and 10000),     -- 1000 = 10.00%
  effective_from timestamptz not null default now(),              -- applies to orders paid at or after this moment
  set_by uuid,
  note text,
  created_at timestamptz not null default now()
);
create index brand_royalty_rates_idx on brand_royalty_rates(brand_id, effective_from desc);

create table royalty_payouts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  paid_on date not null,
  reference text,                                                  -- check/ACH/wire number or note
  created_by uuid,
  created_at timestamptz not null default now()
);
create index royalty_payouts_brand_idx on royalty_payouts(brand_id, paid_on desc);

do $$ declare t text; begin
  for t in select unnest(array['brand_royalty_rates','royalty_payouts']) loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- Payouts and rate changes are audited by the database whoever makes them (one trigger function per table).
create or replace function audit_royalty_payout() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor, action, entity, entity_id, detail)
  values (coalesce(new.created_by::text, 'system'), 'royalty.payout_recorded', 'royalty_payouts', new.brand_id::text,
          jsonb_build_object('amount_cents', new.amount_cents, 'paid_on', new.paid_on, 'reference', left(new.reference, 80)));
  return new;
end $$;
create or replace function audit_royalty_rate() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor, action, entity, entity_id, detail)
  values (coalesce(new.set_by::text, 'system'), 'royalty.rate_set', 'brand_royalty_rates', new.brand_id::text,
          jsonb_build_object('rate_bps', new.rate_bps, 'effective_from', new.effective_from));
  return new;
end $$;
create trigger royalty_payouts_audit after insert on royalty_payouts for each row execute function audit_royalty_payout();
create trigger brand_royalty_rates_audit after insert on brand_royalty_rates for each row execute function audit_royalty_rate();
