-- Ejecutar solo si noticias_cine aún no existe.
begin;
create type public.categoria_cine as enum ('Farándula', 'Estrenos', 'Efemérides', 'Breaking News');
create table public.noticias_cine (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  resumen text not null check (length(trim(resumen)) > 0),
  enlace text not null unique check (length(trim(enlace)) > 0),
  categoria public.categoria_cine not null,
  fecha_creacion timestamptz not null default now()
);
create index noticias_cine_fecha_creacion_idx on public.noticias_cine (fecha_creacion desc);
alter table public.noticias_cine enable row level security;
revoke all on public.noticias_cine from anon, authenticated;
grant usage on schema public to service_role;
grant usage on type public.categoria_cine to service_role;
grant select, insert, update, delete on public.noticias_cine to service_role;
commit;
