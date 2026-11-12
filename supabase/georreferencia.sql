-- Tabla de puntos de control del GPS (calibración desde /admin).
-- Ejecutar una vez en Supabase → SQL Editor (se puede volver a ejecutar sin problema).

create table if not exists public.georreferencia (
  id bigint generated always as identity primary key,
  nombre text not null,
  x numeric not null,            -- posición en el plano (píxeles, 664×489)
  y numeric not null,
  lat double precision not null, -- posición GPS medida en el campus o copiada de Google Maps
  lng double precision not null,
  precision_m numeric,           -- precisión de la medición, si se midió con el celular
  creado_en timestamptz not null default now()
);

alter table public.georreferencia enable row level security;
drop policy if exists "lectura publica" on public.georreferencia;
create policy "lectura publica" on public.georreferencia for select using (true);
drop policy if exists "admins editan" on public.georreferencia;
create policy "admins editan" on public.georreferencia for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

grant select on public.georreferencia to anon, authenticated;
grant insert, update, delete on public.georreferencia to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Puntos iniciales (los mismos de src/data/georreferencia.json), solo si la tabla está vacía.
insert into public.georreferencia (nombre, x, y, lat, lng)
select * from (values
  ('Capilla «El Arca» (centro del techo)', 490, 362, -16.52292283950898::double precision, -68.1118449372547::double precision),
  ('Coliseo (centro del techo)', 335, 152, -16.522314796533973, -68.11186280294254),
  ('Ingreso principal (puerta)', 343, 460, -16.522916416529352, -68.1122201167202)
) as v (nombre, x, y, lat, lng)
where not exists (select 1 from public.georreferencia);
