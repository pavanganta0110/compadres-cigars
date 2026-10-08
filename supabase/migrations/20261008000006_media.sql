-- Admin image uploads (product photos, brand logo/hero). Stored in Postgres and served by /media/<id>,
-- so no separate storage service is needed. Only JPEG/PNG/WebP, max 5 MB; no SVG (it can carry scripts).

create table media (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes int not null check (size_bytes between 1 and 5242880),
  data bytea not null,
  created_by uuid,
  created_at timestamptz not null default now()
);
alter table media enable row level security;
revoke all on media from anon, authenticated;

create or replace function store_media(p_type text, p_b64 text, p_actor uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_data bytea := decode(p_b64, 'base64'); v_id uuid;
begin
  insert into media(content_type, size_bytes, data, created_by) values (p_type, octet_length(v_data), v_data, p_actor) returning id into v_id;
  return v_id;
end $$;

create or replace function get_media(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('content_type', content_type, 'b64', replace(encode(data, 'base64'), E'\n', ''))
  from media where id = p_id
$$;

revoke all on function store_media(text, text, uuid), get_media(uuid) from public, anon, authenticated;
grant execute on function store_media(text, text, uuid), get_media(uuid) to service_role;
