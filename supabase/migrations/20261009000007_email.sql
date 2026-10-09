-- Email: durable outbox (idempotent, retried, audited) and marketing consent on customers.

alter table customers add column marketing_opt_in boolean not null default false;
alter table customers add column marketing_opt_in_at timestamptz;
alter table customers add column marketing_opt_in_source text;
alter table customers add column marketing_opt_out_at timestamptz;

create table email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('order_confirmation','order_shipped','refund_issued','admin_new_order','admin_low_stock','admin_needs_review','admin_test')),
  dedupe_key text not null unique,            -- one email per business event, even if the code path runs twice
  to_email text not null,
  subject text not null,
  payload jsonb not null,                     -- what the template needs (never card data, tokens or keys)
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','dead','skipped')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  provider text, provider_id text, last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_due_idx on email_outbox(status, next_attempt_at);
create trigger email_outbox_updated before update on email_outbox for each row execute function set_updated_at();
alter table email_outbox enable row level security;
revoke all on email_outbox from anon, authenticated;

-- Enqueue once per dedupe key. Returns the new id, or null when that event was already queued.
create or replace function enqueue_email(p_kind text, p_key text, p_to text, p_subject text, p_payload jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into email_outbox(kind, dedupe_key, to_email, subject, payload) values (p_kind, p_key, lower(trim(p_to)), p_subject, p_payload)
    on conflict (dedupe_key) do nothing returning id into v_id;
  return v_id;
end $$;

-- Claim due emails for sending. SKIP LOCKED means two workers never take the same row; a row stuck in 'sending'
-- for 10 minutes (crashed worker) becomes claimable again.
create or replace function claim_emails(p_limit int) returns setof email_outbox
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select id from email_outbox
    where (status in ('queued','failed') and next_attempt_at <= now()) or (status = 'sending' and updated_at < now() - interval '10 minutes')
    order by created_at limit greatest(1, least(p_limit, 50)) for update skip locked
  )
  update email_outbox e set status = 'sending', attempts = e.attempts + 1 from due where e.id = due.id returning e.*;
end $$;

-- Record the outcome. A retryable failure backs off (5, 10, 15 ... minutes) and becomes 'dead' after 5 attempts.
create or replace function finish_email(p_id uuid, p_outcome text, p_provider text, p_provider_id text, p_error text) returns void
language plpgsql security definer set search_path = public as $$
declare v_attempts int;
begin
  select attempts into v_attempts from email_outbox where id = p_id;
  if p_outcome = 'sent' then
    update email_outbox set status = 'sent', sent_at = now(), provider = p_provider, provider_id = p_provider_id, last_error = null where id = p_id;
  elsif p_outcome = 'skipped' then
    update email_outbox set status = 'skipped', provider = p_provider, last_error = left(p_error, 200) where id = p_id;
  elsif p_outcome = 'retry' and v_attempts < 5 then
    update email_outbox set status = 'failed', next_attempt_at = now() + make_interval(mins => 5 * v_attempts), provider = p_provider, last_error = left(p_error, 200) where id = p_id;
  else
    update email_outbox set status = 'dead', provider = p_provider, last_error = left(p_error, 200) where id = p_id;
  end if;
end $$;

revoke all on function enqueue_email(text, text, text, text, jsonb), claim_emails(int), finish_email(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function enqueue_email(text, text, text, text, jsonb), claim_emails(int), finish_email(uuid, text, text, text, text) to service_role;
