-- Facturtaxi: aprobación manual de nuevas cuentas
-- Ejecutar en el SQL Editor DESPUÉS de 0001_init.sql (no repitas 0001, ya la tienes aplicada).

alter table public.profiles
  add column if not exists approved boolean not null default false;

-- Restringe qué columnas puede modificar el propio usuario desde la app:
-- nunca "approved" (evita que alguien se autoapruebe llamando directamente
-- a la API con su token, aunque la interfaz nunca envíe ese campo).
revoke update on public.profiles from authenticated;
grant update (
  company_name, tax_id, address, phone, email,
  logo_url, stamp_url, signature_url,
  accent_color, template_style, default_iva, invoice_series_prefix
) on public.profiles to authenticated;

-- Aprueba automáticamente a las cuentas que ya existían antes de este cambio
-- (para no bloquearte a ti mismo con tu cuenta actual).
update public.profiles set approved = true;

-- A partir de ahora, cualquier cuenta NUEVA entra como pendiente (approved =
-- false) hasta que tú, como administrador, la apruebes manualmente
-- ejecutando algo como:
--   update public.profiles set approved = true where email = 'nuevo@email.com';
-- (puedes verlas también en Table Editor -> profiles, columna "approved").
