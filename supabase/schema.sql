-- Esquema de "¿Dónde es? · Campus UCB La Paz"
-- Ejecutar en Supabase → SQL Editor (se puede volver a ejecutar sin problema).
-- Después ejecutar seed.sql para cargar el mapa, las dependencias y los eventos iniciales.

-- ---------- Tablas ----------

create table if not exists public.lugares (
  id text primary key,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'bloque', 'punto', 'cruce')),
  bloque text,
  x numeric,            -- coordenadas en píxeles del plano (mapa-campus.png, 664×489)
  y numeric,
  piso integer not null default 0,
  descripcion text,
  direccion text
);

create table if not exists public.caminos (
  id bigint generated always as identity primary key,
  desde text not null references public.lugares (id) on update cascade on delete cascade,
  hasta text not null references public.lugares (id) on update cascade on delete cascade,
  tipo text not null default 'camino' check (tipo in ('camino', 'escaleras', 'rampa', 'ascensor')),
  distancia_m numeric,  -- null = se calcula con la escala del plano
  indicacion text,      -- texto al ir de "desde" a "hasta"
  indicacion_vuelta text -- texto al ir de "hasta" a "desde"
);

create table if not exists public.dependencias (
  id bigint generated always as identity primary key,
  lugar_id text not null references public.lugares (id) on update cascade on delete cascade,
  nombre text not null
);

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  inicio timestamptz not null,
  fin timestamptz not null,
  lugar_id text not null references public.lugares (id) on update cascade,
  ambiente text,
  organizador text,
  por_confirmar boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint eventos_fechas check (fin >= inicio)
);

create table if not exists public.config (
  clave text primary key,
  valor numeric not null
);

-- Puntos de control del GPS (se cargan desde /admin → Calibrar el GPS).
create table if not exists public.georreferencia (
  id bigint generated always as identity primary key,
  nombre text not null,
  x numeric not null,
  y numeric not null,
  lat double precision not null,
  lng double precision not null,
  precision_m numeric,
  creado_en timestamptz not null default now()
);

-- Correos con permiso para editar. Se administra solo desde el SQL Editor.
create table if not exists public.admins (
  email text primary key
);

create index if not exists caminos_desde_idx on public.caminos (desde);
create index if not exists caminos_hasta_idx on public.caminos (hasta);
create index if not exists dependencias_lugar_idx on public.dependencias (lugar_id);
create index if not exists eventos_inicio_idx on public.eventos (inicio);

-- ---------- Permisos ----------

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

alter table public.lugares enable row level security;
alter table public.caminos enable row level security;
alter table public.dependencias enable row level security;
alter table public.eventos enable row level security;
alter table public.config enable row level security;
alter table public.georreferencia enable row level security;
alter table public.admins enable row level security; -- sin políticas: nadie la lee desde la API

do $$
declare
  t text;
begin
  foreach t in array array['lugares', 'caminos', 'dependencias', 'eventos', 'config', 'georreferencia'] loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select using (true)', t);
    execute format('drop policy if exists "admins editan" on public.%I', t);
    execute format(
      'create policy "admins editan" on public.%I for all to authenticated using (public.es_admin()) with check (public.es_admin())',
      t
    );
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.lugares, public.caminos, public.dependencias, public.eventos, public.config, public.georreferencia to anon, authenticated;
grant insert, update, delete on public.lugares, public.caminos, public.dependencias, public.eventos, public.config, public.georreferencia to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.es_admin() to anon, authenticated;
