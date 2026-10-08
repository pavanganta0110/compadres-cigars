-- Phase 3: payments (sandbox first), refunds, webhook idempotency, encrypted processor credentials.
-- Card data never reaches the database: only opaque processor references are stored.

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  provider text not null,                 -- 'mock' | 'quickbooks'
  mode text not null check (mode in ('mock','sandbox','live')),
  status text not null check (status in ('authorizing','authorized','captured','declined','voided','failed')),
  amount_cents int not null check (amount_cents > 0),
  captured_cents int not null default 0 check (captured_cents >= 0),
  refunded_cents int not null default 0 check (refunded_cents >= 0 and refunded_cents <= captured_cents),
  attempt int not null default 1,
  authorization_ref text, charge_ref text,
  decline_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most ONE live-or-captured payment per order: this is what makes a double submit charge once.
create unique index payments_one_active_per_order on payments(order_id) where status in ('authorizing','authorized','captured');
create index payments_order_idx on payments(order_id);
create trigger payments_updated before update on payments for each row execute function set_updated_at();

alter table refunds add column payment_id uuid references payments(id);
alter table refunds add column status text not null default 'completed' check (status in ('pending','completed','failed'));
alter table refunds add column failure_code text;
create unique index refunds_provider_reference_uq on refunds(provider_reference) where provider_reference is not null;

-- Processed webhook event ids (idempotency).
create table payment_events (
  provider text not null,
  event_id text not null,
  type text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- OAuth credentials for the processor, encrypted by the application (AES-256-GCM) before they get here.
create table payment_credentials (
  provider text primary key,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

do $$ declare t text; begin
  for t in select unnest(array['payments','payment_events','payment_credentials']) loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;

-- ---------- begin a payment attempt (claims the order) ----------
create or replace function begin_payment(p_order uuid, p_provider text, p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order orders%rowtype; v_attempt int; v_id uuid;
begin
  select * into v_order from orders where id = p_order for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'order_not_found'); end if;
  if v_order.status <> 'pending' then return jsonb_build_object('ok', false, 'code', 'already_paid'); end if;
  if v_order.total_cents <= 0 then return jsonb_build_object('ok', false, 'code', 'invalid_amount'); end if;
  if exists (select 1 from payments where order_id = p_order and status in ('authorizing','authorized','captured')) then
    return jsonb_build_object('ok', false, 'code', 'payment_in_progress');
  end if;
  select coalesce(max(attempt), 0) + 1 into v_attempt from payments where order_id = p_order;
  insert into payments(order_id, provider, mode, status, amount_cents, attempt)
    values (p_order, p_provider, p_mode, 'authorizing', v_order.total_cents, v_attempt) returning id into v_id;
  return jsonb_build_object('ok', true, 'payment_id', v_id, 'amount_cents', v_order.total_cents, 'attempt', v_attempt);
end $$;

-- ---------- capture succeeded: pending -> processing and paid_at, atomically ----------
create or replace function complete_payment(p_payment uuid, p_charge_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay payments%rowtype;
begin
  select * into v_pay from payments where id = p_payment for update;
  if not found or v_pay.status not in ('authorizing','authorized') then return jsonb_build_object('ok', false, 'code', 'bad_payment_state'); end if;
  update payments set status = 'captured', captured_cents = amount_cents, charge_ref = p_charge_ref where id = p_payment;
  update orders set status = 'processing', paid_at = now(), payment_provider = v_pay.provider, payment_reference = p_charge_ref
    where id = v_pay.order_id and status = 'pending';
  if not found then raise exception 'order_not_pending'; end if;
  insert into audit_log(actor, action, entity, entity_id, detail)
    values ('system', 'payment.captured', 'orders', v_pay.order_id::text, jsonb_build_object('payment_id', p_payment, 'amount_cents', v_pay.amount_cents, 'provider', v_pay.provider, 'mode', v_pay.mode));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- refunds: reserve first (so concurrent clicks cannot exceed the captured amount), then finish ----------
create or replace function begin_refund(p_order uuid, p_amount int, p_reason text, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_pay payments%rowtype; v_reserved bigint; v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'code', 'invalid_amount'); end if;
  select * into v_pay from payments where order_id = p_order and status = 'captured' for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'nothing_to_refund'); end if;
  select coalesce(sum(amount_cents), 0) into v_reserved from refunds where payment_id = v_pay.id and status in ('pending','completed');
  if v_reserved + p_amount > v_pay.captured_cents then
    return jsonb_build_object('ok', false, 'code', 'exceeds_captured', 'refundable_cents', v_pay.captured_cents - v_reserved);
  end if;
  insert into refunds(order_id, payment_id, amount_cents, reason, created_by, status)
    values (p_order, v_pay.id, p_amount, p_reason, p_actor, 'pending') returning id into v_id;
  return jsonb_build_object('ok', true, 'refund_id', v_id, 'charge_ref', v_pay.charge_ref, 'provider', v_pay.provider, 'mode', v_pay.mode);
end $$;

create or replace function finish_refund(p_refund uuid, p_ok boolean, p_provider_ref text, p_failure text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ref refunds%rowtype; v_pay payments%rowtype;
begin
  select * into v_ref from refunds where id = p_refund for update;
  if not found or v_ref.status <> 'pending' then return jsonb_build_object('ok', false, 'code', 'bad_refund_state'); end if;
  if not p_ok then
    update refunds set status = 'failed', failure_code = left(coalesce(p_failure, 'failed'), 80) where id = p_refund;
    return jsonb_build_object('ok', true, 'status', 'failed');
  end if;
  update refunds set status = 'completed', provider_reference = p_provider_ref where id = p_refund;
  update payments set refunded_cents = refunded_cents + v_ref.amount_cents where id = v_ref.payment_id returning * into v_pay;
  if v_pay.refunded_cents = v_pay.captured_cents then
    update orders set status = 'refunded' where id = v_ref.order_id;
  end if;
  return jsonb_build_object('ok', true, 'status', 'completed', 'fully_refunded', v_pay.refunded_cents = v_pay.captured_cents);
end $$;

-- ---------- webhook idempotency: true only the first time an event id is seen ----------
create or replace function claim_payment_event(p_provider text, p_event_id text, p_type text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into payment_events(provider, event_id, type) values (p_provider, p_event_id, p_type) on conflict do nothing;
  return found;
end $$;

revoke all on function begin_payment(uuid, text, text), complete_payment(uuid, text), begin_refund(uuid, int, text, uuid),
  finish_refund(uuid, boolean, text, text), claim_payment_event(text, text, text) from public, anon, authenticated;
grant execute on function begin_payment(uuid, text, text), complete_payment(uuid, text), begin_refund(uuid, int, text, uuid),
  finish_refund(uuid, boolean, text, text), claim_payment_event(text, text, text) to service_role;
