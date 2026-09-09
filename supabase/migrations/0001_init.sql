-- Facturtaxi: esquema inicial
-- Ejecutar en el SQL Editor de tu proyecto Supabase (https://app.supabase.com -> SQL Editor)

-- 1. PERFILES (datos fiscales + plantilla de cada taxista) ------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null default '',
  tax_id text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  logo_url text,
  stamp_url text,
  signature_url text,
  accent_color text not null default '#0d9488',
  template_style text not null default 'clasico' check (template_style in ('clasico', 'moderno', 'simple')),
  default_iva numeric(5, 2) not null default 10,
  invoice_series_prefix text not null default to_char(now(), 'YYYY'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Crea automáticamente un perfil vacío cuando se registra un usuario nuevo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, invoice_series_prefix)
  values (new.id, coalesce(new.email, ''), to_char(now(), 'YYYY'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. CLIENTES ----------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  tax_id text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "clients: select own" on public.clients
  for select using (auth.uid() = user_id);
create policy "clients: insert own" on public.clients
  for insert with check (auth.uid() = user_id);
create policy "clients: update own" on public.clients
  for update using (auth.uid() = user_id);
create policy "clients: delete own" on public.clients
  for delete using (auth.uid() = user_id);

-- 3. CONTADOR DE NUMERACIÓN CORRELATIVA --------------------------------------
create table if not exists public.invoice_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  series text not null,
  last_number integer not null default 0,
  primary key (user_id, series)
);

alter table public.invoice_counters enable row level security;

create policy "invoice_counters: select own" on public.invoice_counters
  for select using (auth.uid() = user_id);

-- 4. FACTURAS ------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  series text not null,
  number integer not null,
  issue_date date not null default current_date,
  service_date date not null,
  description text not null default '',
  base_amount numeric(10, 2) not null,
  iva_rate numeric(5, 2) not null,
  iva_amount numeric(10, 2) not null,
  total_amount numeric(10, 2) not null,
  pdf_path text,
  signed_with_certificate boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, series, number)
);

alter table public.invoices enable row level security;

create policy "invoices: select own" on public.invoices
  for select using (auth.uid() = user_id);
create policy "invoices: insert own" on public.invoices
  for insert with check (auth.uid() = user_id);
create policy "invoices: update own" on public.invoices
  for update using (auth.uid() = user_id);

-- 5. FUNCIÓN ATÓMICA PARA OBTENER EL SIGUIENTE NÚMERO ------------------------
-- Bloquea la fila del contador (o la crea) e incrementa dentro de la misma
-- transacción, para que dos facturas no puedan recibir el mismo número
-- aunque se creen casi al mismo tiempo.
create or replace function public.get_next_invoice_number(p_series text)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_next integer;
begin
  insert into public.invoice_counters (user_id, series, last_number)
  values (auth.uid(), p_series, 0)
  on conflict (user_id, series) do nothing;

  update public.invoice_counters
  set last_number = last_number + 1
  where user_id = auth.uid() and series = p_series
  returning last_number into v_next;

  return v_next;
end;
$$;

grant execute on function public.get_next_invoice_number(text) to authenticated;

-- 6. STORAGE: buckets privados -------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('branding', 'branding', false),
  ('invoices', 'invoices', false)
on conflict (id) do nothing;

-- Cada usuario solo puede leer/escribir dentro de una carpeta con su propio uid
-- (las rutas se guardan como "<uid>/logo.png", "<uid>/factura-2026-0001.pdf", etc.)
create policy "branding: owner read" on storage.objects
  for select using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "branding: owner write" on storage.objects
  for insert with check (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "branding: owner update" on storage.objects
  for update using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "branding: owner delete" on storage.objects
  for delete using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "invoices: owner read" on storage.objects
  for select using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "invoices: owner write" on storage.objects
  for insert with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
