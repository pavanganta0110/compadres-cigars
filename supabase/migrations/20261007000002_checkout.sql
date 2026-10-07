-- Phase 2: checkout, compliance reference data, atomic order creation.

-- ---------- 50-state tax matrix (business-approved Avg Combined Reference %, effective 2026-08-19) ----------
-- Source: Compadres_Cigars_50_State_Tobacco_Tax_Matrix_2026.xlsx, sha256 802f4b18...e36b3. No DC row: DC fails closed.
-- Rates are ESTIMATES (state-level averages) and need tax-professional review before production.
insert into tax_rates (state, rate_bps, matrix_sha256, effective_date) values
('AL', 946, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('AK', 182, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('AZ', 852, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('AR', 946, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('CA', 899, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('CO', 789, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('CT', 635, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('DE', 0, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('FL', 698, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('GA', 749, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('HI', 450, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('ID', 603, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('IL', 896, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('IN', 700, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('IA', 694, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('KS', 869, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('KY', 600, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('LA', 1011, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('ME', 550, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('MD', 600, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('MA', 625, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('MI', 600, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('MN', 814, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('MS', 706, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('MO', 844, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('MT', 0, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('NE', 698, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('NV', 824, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('NH', 0, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('NJ', 660, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('NM', 767, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('NY', 854, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('NC', 700, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('ND', 709, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('OH', 729, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('OK', 906, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('OR', 0, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('PA', 634, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('RI', 700, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('SC', 749, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('SD', 611, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('TN', 961, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('TX', 820, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('UT', 742, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('VT', 639, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('VA', 577, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('WA', 951, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('WV', 659, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('WI', 572, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19'),
('WY', 556, '802f4b18906fe7e6a25c179885ad7fb2b7a536951ab1a9d17b98bdfa249e36b3', '2026-08-19');

-- ---------- restriction rules: fail closed ----------
-- Every state starts BLOCKED. A state with no row is also blocked. Staff must explicitly allow a state.
-- This table is NOT a complete statement of the law and must be set from the licensed list of states.
insert into restriction_rules (state, status, note)
select s, 'blocked', 'Pending staff review: not approved for shipping' from (values
('AL'),
('AK'),
('AZ'),
('AR'),
('CA'),
('CO'),
('CT'),
('DE'),
('FL'),
('GA'),
('HI'),
('ID'),
('IL'),
('IN'),
('IA'),
('KS'),
('KY'),
('LA'),
('ME'),
('MD'),
('MA'),
('MI'),
('MN'),
('MS'),
('MO'),
('MT'),
('NE'),
('NV'),
('NH'),
('NJ'),
('NM'),
('NY'),
('NC'),
('ND'),
('OH'),
('OK'),
('OR'),
('PA'),
('RI'),
('SC'),
('SD'),
('TN'),
('TX'),
('UT'),
('VT'),
('VA'),
('WA'),
('WV'),
('WI'),
('WY')) v(s);

create or replace function audit_restriction_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(actor, action, entity, entity_id, detail)
  values (coalesce(new.updated_by::text, 'system'), 'restriction.changed', 'restriction_rules', new.state,
          jsonb_build_object('from', case when tg_op = 'UPDATE' then old.status end, 'to', new.status, 'note', new.note));
  return new;
end $$;
create trigger restriction_rules_audit after insert or update on restriction_rules
  for each row execute function audit_restriction_change();
-- (seed inserts above ran before the trigger existed on purpose; log them once)
insert into audit_log(actor, action, entity, entity_id, detail)
select 'system', 'restriction.seeded', 'restriction_rules', state, jsonb_build_object('to', status) from restriction_rules;

-- ---------- idempotency leases ----------
create table checkout_leases (
  key text primary key,
  locked_at timestamptz not null default now(),
  order_id uuid references orders(id) on delete set null
);
alter table checkout_leases enable row level security;
revoke all on checkout_leases from anon, authenticated;

-- ---------- atomic order creation ----------
-- Service-role only. Re-checks stock, geography, tax and age inside ONE transaction, takes the 60s
-- idempotency lease, decrements stock and writes the immutable compliance snapshot.
create or replace function create_checkout_order(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_state char(2) := upper(p #>> '{address,state}');
  v_rule text; v_rate int; v_sub bigint := 0; v_tax bigint; v_ship int := (p #>> '{shipping,cents}')::int;
  v_item jsonb; v_prod products%rowtype; v_qty int; v_lease_key text := p ->> 'lease_key';
  v_customer uuid; v_order orders%rowtype; v_age jsonb := p -> 'age'; v_existing checkout_leases%rowtype;
begin
  -- lease: unique key = cart fingerprint + destination + shipping + checkout session
  insert into checkout_leases(key, locked_at) values (v_lease_key, now())
    on conflict (key) do update set locked_at = now()
      where checkout_leases.locked_at < now() - interval '60 seconds'
    returning * into v_existing;
  if not found then
    select * into v_existing from checkout_leases where key = v_lease_key;
    return jsonb_build_object('ok', false, 'code', case when v_existing.order_id is not null then 'duplicate_order' else 'locked' end,
                              'order_id', v_existing.order_id);
  end if;

  -- geography (fail closed)
  select status into v_rule from restriction_rules where state = v_state;
  if v_rule is distinct from 'allowed' then raise exception 'geo_blocked' using errcode = 'P0001'; end if;

  -- age (provider result must be verified and unexpired)
  if coalesce(v_age ->> 'status', '') <> 'passed' or (v_age ->> 'expires_at')::timestamptz <= now() then
    raise exception 'age_not_verified' using errcode = 'P0001';
  end if;

  -- tax rate (unsupported destinations fail closed)
  select rate_bps into v_rate from tax_rates where state = v_state;
  if v_rate is null then raise exception 'tax_unsupported' using errcode = 'P0001'; end if;

  -- stock + authoritative prices
  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    v_qty := (v_item ->> 'quantity')::int;
    select * into v_prod from products where id = (v_item ->> 'product_id')::uuid and active for update;
    if not found or v_qty < 1 or v_prod.stock < v_qty then raise exception 'stock_unavailable' using errcode = 'P0001'; end if;
    v_sub := v_sub + v_prod.price_cents::bigint * v_qty;
  end loop;
  if v_sub <> (p ->> 'expected_subtotal_cents')::bigint then raise exception 'price_changed' using errcode = 'P0001'; end if;
  v_tax := (v_sub * v_rate + 5000) / 10000;   -- shipping is non-taxable
  if v_tax <> (p ->> 'expected_tax_cents')::bigint then raise exception 'tax_mismatch' using errcode = 'P0001'; end if;

  insert into customers(email, full_name) values (lower(p ->> 'email'), p ->> 'full_name')
    on conflict (email) do update set full_name = coalesce(excluded.full_name, customers.full_name) returning id into v_customer;

  insert into orders(customer_id, email, status, subtotal_cents, shipping_cents, tax_cents, total_cents, tax_snapshot,
      compliance_snapshot, compliance_snapshot_version, shipping_address, shipping_service, adult_signature_required, idempotency_key)
  values (v_customer, lower(p ->> 'email'), 'pending', v_sub, v_ship, v_tax, v_sub + v_ship + v_tax,
      p -> 'tax_snapshot', p -> 'compliance_snapshot', (p ->> 'compliance_snapshot_version')::int,
      p -> 'address', p #>> '{shipping,service}', true, v_lease_key)
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p -> 'items') loop
    select * into v_prod from products where id = (v_item ->> 'product_id')::uuid;
    v_qty := (v_item ->> 'quantity')::int;
    insert into order_items(order_id, product_id, sku, name, quantity, unit_price_cents)
      values (v_order.id, v_prod.id, v_prod.sku, v_prod.name, v_qty, v_prod.price_cents);
    update products set stock = stock - v_qty where id = v_prod.id;
  end loop;

  insert into age_verifications(order_id, provider, reference, status, verified_at, expires_at)
    values (v_order.id, v_age ->> 'provider', v_age ->> 'reference', 'verified', (v_age ->> 'verified_at')::timestamptz, (v_age ->> 'expires_at')::timestamptz);
  update checkout_leases set order_id = v_order.id where key = v_lease_key;
  insert into audit_log(actor, action, entity, entity_id, detail)
    values ('system', 'checkout.order_created', 'orders', v_order.id::text, jsonb_build_object('number', v_order.number, 'state', v_state, 'total_cents', v_order.total_cents));
  return jsonb_build_object('ok', true, 'order_id', v_order.id, 'number', v_order.number, 'total_cents', v_order.total_cents);
exception when sqlstate 'P0001' then
  -- roll the lease back with the rest of the transaction; surface a stable code to the app
  return jsonb_build_object('ok', false, 'code', sqlerrm);
end $$;
revoke all on function create_checkout_order(jsonb) from public, anon, authenticated;
grant execute on function create_checkout_order(jsonb) to service_role;
