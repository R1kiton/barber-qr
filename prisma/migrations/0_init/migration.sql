-- Migracion base: refleja el esquema que YA existe en Supabase.
-- Se marca como aplicada con `prisma migrate resolve --applied 0_init`;
-- no se ejecuta sobre la base actual.
--
-- Aqui viven las piezas que schema.prisma no sabe expresar: los CHECK,
-- la columna generada `code` y la restriccion `exclude` anti-solapes.

-- Esquema de BarberQR para Supabase (Postgres).
-- Se puede ejecutar varias veces sin romper nada.

-- btree_gist aporta los operadores que usa la restricción `exclude` de las citas.
-- En `extensions` (convención de Supabase) para no ensuciar `public`.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

-- Barberías ---------------------------------------------------------------
create table if not exists public.shops (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name        text not null,
  address     text not null default '',
  phone       text not null default '',
  pin_hash    text not null,
  open_time   text not null,              -- "HH:MM"
  close_time  text not null,              -- "HH:MM"
  work_days   smallint[] not null,        -- 0 = domingo … 6 = sábado
  created_at  timestamptz not null default now()
);

-- Servicios ---------------------------------------------------------------
create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops(id) on delete cascade,
  name          text not null,
  duration_min  int not null check (duration_min between 15 and 240),
  price         numeric(10,2) not null default 0 check (price >= 0),
  created_at    timestamptz not null default now()
);
create index if not exists services_shop_idx on public.services(shop_id);

-- Barberos ----------------------------------------------------------------
create table if not exists public.barbers (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists barbers_shop_idx on public.barbers(shop_id);

-- Citas -------------------------------------------------------------------
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  -- Código corto que se muestra bajo el QR del cliente
  code            text generated always as (upper(substr(replace(id::text, '-', ''), 1, 6))) stored,
  shop_id         uuid not null references public.shops(id) on delete cascade,
  service_id      uuid references public.services(id) on delete set null,
  barber_id       uuid references public.barbers(id) on delete set null,
  service_name    text not null,           -- copia, por si luego se borra el servicio
  price           numeric(10,2) not null default 0,
  date            date not null,
  time            text not null,           -- "HH:MM"
  start_min       int not null,
  end_min         int not null check (end_min > start_min),
  customer_name   text not null,
  customer_phone  text not null,
  status          text not null default 'confirmada'
                  check (status in ('confirmada', 'completada', 'cancelada')),
  checked_in_at   timestamptz,             -- cuándo se escaneó el QR en la barbería
  created_at      timestamptz not null default now(),

  -- La base de datos impide dos citas solapadas con el mismo barbero.
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    date with =,
    int4range(start_min, end_min) with &&
  ) where (status <> 'cancelada' and barber_id is not null)
);
create index if not exists appointments_shop_date_idx on public.appointments(shop_id, date);
create index if not exists appointments_shop_code_idx on public.appointments(shop_id, code);

-- Seguridad ---------------------------------------------------------------
-- RLS activado y sin políticas: nadie puede leer ni escribir con la clave pública.
-- La app accede solo desde el servidor con la clave secreta (que salta RLS).
alter table public.shops        enable row level security;
alter table public.services     enable row level security;
alter table public.barbers      enable row level security;
alter table public.appointments enable row level security;
