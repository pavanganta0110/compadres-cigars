-- Admin: editable tax rates (audited) and per-product low-stock thresholds.

alter table tax_rates add column updated_by uuid;
alter table tax_rates add column updated_at timestamptz not null default now();

alter table products add column low_stock_threshold int not null default 5 check (low_stock_threshold between 0 and 100000);

-- Every rate change is audited, whoever (or whatever) makes it.
create or replace function audit_tax_rate_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor, action, entity, entity_id, detail)
  values (coalesce(new.updated_by::text, 'system'), 'tax.rate_changed', 'tax_rates', new.state,
          jsonb_build_object('from_bps', old.rate_bps, 'to_bps', new.rate_bps, 'source', new.matrix_sha256, 'effective_date', new.effective_date));
  return new;
end $$;
create trigger tax_rates_audit after update on tax_rates
  for each row when (old.rate_bps is distinct from new.rate_bps) execute function audit_tax_rate_change();
