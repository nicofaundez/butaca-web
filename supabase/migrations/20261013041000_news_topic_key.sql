-- Tema clave de cada noticia para descartar la misma historia publicada por otro medio.
begin;
alter table public.noticias_cine add column if not exists tema_clave text;
create index if not exists noticias_cine_tema_clave_idx on public.noticias_cine (tema_clave, fecha_creacion desc);
commit;
