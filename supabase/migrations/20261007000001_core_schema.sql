-- Compadres Cigars core schema. RLS is enabled on EVERY table.
-- Server code uses the service-role key for writes; browsers (anon/authenticated) get
-- read-only access to public catalog tables only. Everything else is deny-by-default.

create extension if not exists pgcrypto;

create type order_status as enum ('pending','processing','packed','completed','cancelled','refunded');
create type staff_role as enum ('owner','manager','fulfillment','viewer');

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- catalog ----------
create table brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  tagline text,
  short_description text,
  story text,
  logo_path text,
  hero_path text,
  accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
  template text not null default 'default' check (template in ('default','isley','sugarhill')),
  display_order int not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  sku text not null unique,
  name text not null,
  short_description text,
  description text,
  price_cents int not null check (price_cents >= 0),
  stock int not null default 0 check (stock >= 0),
  box_quantity int not null default 10 check (box_quantity between 1 and 1000),
  vitola text,
  length_in numeric(4,2) check (length_in is null or length_in between 0 and 20),
  ring_gauge int check (ring_gauge is null or ring_gauge between 0 and 100),
  country_of_origin text,
  strength text check (strength is null or strength in ('mild','mild-medium','medium','medium-full','full')),
  wrapper text, binder text, filler text, flavor_profile text,
  weight_oz numeric(7,2), ship_length_in numeric(6,2), ship_width_in numeric(6,2), ship_height_in numeric(6,2),
  sales_tax_classification text not null default 'cigar' check (sales_tax_classification = 'cigar'),
  placeholder_price boolean not null default true,  -- true until the owner approves real pricing
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_brand_idx on products(brand_id);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  path text not null,
  alt text not null,
  position int not null default 0
);
create index product_images_product_idx on product_images(product_id, position);

-- ---------- customers ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email text not null unique,
  full_name text,
  phone text,
  erased_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null default 'shipping' check (kind in ('shipping','billing')),
  recipient text not null,
  line1 text not null, line2 text,
  city text not null,
  state char(2) not null,
  postal_code text not null,
  country char(2) not null default 'US',
  created_at timestamptz not null default now()
);

-- ---------- compliance reference data ----------
create table restriction_rules (
  state char(2) primary key,
  status text not null default 'blocked' check (status in ('allowed','blocked')),
  note text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table tax_rates (
  state char(2) primary key,
  rate_bps int not null check (rate_bps between 0 and 3000),  -- basis points, avg combined rate
  matrix_sha256 text not null,
  effective_date date not null
);

-- ---------- orders ----------
create table orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  customer_id uuid references customers(id) on delete set null,
  email text not null,
  status order_status not null default 'pending',
  currency char(3) not null default 'USD',
  subtotal_cents int not null check (subtotal_cents >= 0),
  shipping_cents int not null default 0 check (shipping_cents >= 0),
  tax_cents int not null default 0 check (tax_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  tax_snapshot jsonb,                      -- {state, rate_bps, matrix_sha256, effective_date, taxable_cents}
  compliance_snapshot jsonb,               -- immutable; see trigger below
  compliance_snapshot_version int,
  shipping_address jsonb,
  shipping_service text,
  adult_signature_required boolean not null default true,
  idempotency_key text unique,
  idempotency_lease_until timestamptz,
  payment_provider text, payment_reference text,
  tracking_number text check (tracking_number is null or tracking_number ~ '^[A-Za-z0-9]{6,34}$'),
  carrier_status_code text, carrier_status_text text, carrier_status_checked_at timestamptz,
  packed_at timestamptz, paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on orders(status, created_at);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  sku text not null, name text not null,
  quantity int not null check (quantity > 0),
  unit_price_cents int not null check (unit_price_cents >= 0)
);

create table age_verifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  provider text not null,             -- 'self_attestation' now; vendor name later
  reference text,
  status text not null check (status in ('verified','failed','pending')),
  verified_at timestamptz, expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  carrier text not null default 'fedex',
  tracking_number text not null,
  service text,
  status_code text, status_text text, checked_at timestamptz,
  created_at timestamptz not null default now()
);

create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  amount_cents int not null check (amount_cents > 0),
  provider_reference text,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,              -- user id or 'system'
  action text not null,
  entity text, entity_id text,
  detail jsonb not null default '{}'::jsonb  -- redacted by application before insert
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role staff_role not null,
  created_at timestamptz not null default now()
);

-- ---------- immutability ----------
-- Compliance snapshot is write-once; audit_log is append-only.
create or replace function guard_compliance_snapshot() returns trigger language plpgsql as $$
begin
  if old.compliance_snapshot is not null and
     (new.compliance_snapshot is distinct from old.compliance_snapshot
      or new.compliance_snapshot_version is distinct from old.compliance_snapshot_version) then
    raise exception 'compliance_snapshot is immutable once written';
  end if;
  return new;
end $$;
create trigger orders_snapshot_guard before update on orders
  for each row execute function guard_compliance_snapshot();

create or replace function audit_append_only() returns trigger language plpgsql as $$
begin raise exception 'audit_log is append-only'; end $$;
create trigger audit_no_update before update or delete on audit_log
  for each row execute function audit_append_only();

do $$ declare t text; begin
  for t in select unnest(array['brands','products','customers','orders']) loop
    execute format('create trigger %I_updated before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- RLS: enable everywhere ----------
do $$ declare t text; begin
  for t in select unnest(array['brands','products','product_images','customers','addresses','restriction_rules',
    'tax_rates','orders','order_items','age_verifications','shipments','refunds','audit_log','settings','staff']) loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Public, read-only catalog.
create policy brands_public_read on brands for select to anon, authenticated using (active);
create policy products_public_read on products for select to anon, authenticated
  using (active and exists (select 1 from brands b where b.id = brand_id and b.active));
create policy product_images_public_read on product_images for select to anon, authenticated
  using (exists (select 1 from products p where p.id = product_id and p.active));

-- Customers see only their own rows.
create policy customers_own on customers for select to authenticated using (auth_user_id = auth.uid());
create policy addresses_own on addresses for select to authenticated
  using (exists (select 1 from customers c where c.id = customer_id and c.auth_user_id = auth.uid()));
create policy orders_own on orders for select to authenticated
  using (exists (select 1 from customers c where c.id = customer_id and c.auth_user_id = auth.uid()));
create policy order_items_own on order_items for select to authenticated
  using (exists (select 1 from orders o join customers c on c.id = o.customer_id
                 where o.id = order_id and c.auth_user_id = auth.uid()));

-- Staff may read their own role row. All other tables: no policy = no access for anon/authenticated;
-- the service role (server only) bypasses RLS. Admin reads/writes go through server code that checks `staff`.
create policy staff_self on staff for select to authenticated using (user_id = auth.uid());

revoke all on all tables in schema public from anon, authenticated;
grant select on brands, products, product_images to anon, authenticated;
grant select on customers, addresses, orders, order_items, staff to authenticated;
