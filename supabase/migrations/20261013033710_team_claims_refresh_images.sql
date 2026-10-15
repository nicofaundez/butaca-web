begin;
alter table public.noticias_cine
  add column if not exists imagen_url text,
  add column if not exists owner_id uuid,
  add column if not exists tomada_por text,
  add column if not exists tomada_en timestamptz,
  add column if not exists publicada boolean not null default false;

create table public.butaca_jobs (
  job_key text primary key,
  token uuid,
  lease_until timestamptz,
  next_allowed timestamptz not null default '-infinity',
  last_success timestamptz,
  last_failed boolean not null default false
);
alter table public.butaca_jobs enable row level security;
revoke all on public.butaca_jobs from anon, authenticated;
grant select, insert, update on public.butaca_jobs to service_role;

create function public.butaca_claim(p_id uuid, p_member uuid, p_name text, p_action text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if p_member is null or length(trim(p_name)) not between 2 and 60 then return false; end if;
  if p_action = 'take' then
    update public.noticias_cine set owner_id = p_member, tomada_por = trim(p_name), tomada_en = now()
    where id = p_id and owner_id is null and not publicada;
  elsif p_action = 'release' then
    update public.noticias_cine set owner_id = null, tomada_por = null, tomada_en = null
    where id = p_id and owner_id = p_member and not publicada;
  elsif p_action = 'publish' then
    update public.noticias_cine set publicada = true
    where id = p_id and owner_id = p_member and not publicada;
  else return false;
  end if;
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create function public.butaca_begin_job(p_key text, p_token uuid, p_seconds integer)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if p_token is null or p_seconds not between 30 and 3600 or p_key not in ('news', 'media-search') then return false; end if;
  insert into public.butaca_jobs (job_key) values (p_key) on conflict do nothing;
  update public.butaca_jobs set token = p_token, lease_until = now() + interval '4 minutes',
    next_allowed = now() + make_interval(secs => p_seconds), last_failed = false
  where job_key = p_key and next_allowed <= now() and (lease_until is null or lease_until <= now());
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create function public.butaca_end_job(p_key text, p_token uuid, p_success boolean)
returns void language sql security invoker set search_path = '' as $$
  update public.butaca_jobs set lease_until = null, token = null,
    last_success = case when p_success then now() else last_success end,
    last_failed = not p_success
  where job_key = p_key and token = p_token;
$$;

revoke all on function public.butaca_claim(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.butaca_begin_job(text, uuid, integer) from public, anon, authenticated;
revoke all on function public.butaca_end_job(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.butaca_claim(uuid, uuid, text, text) to service_role;
grant execute on function public.butaca_begin_job(text, uuid, integer) to service_role;
grant execute on function public.butaca_end_job(text, uuid, boolean) to service_role;
commit;
