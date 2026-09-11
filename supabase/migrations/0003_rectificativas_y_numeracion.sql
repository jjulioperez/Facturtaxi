-- Facturtaxi: facturas rectificativas + permitir fijar el próximo número
-- Ejecutar en el SQL Editor DESPUÉS de 0001_init.sql y 0002_approval_gate.sql

alter table public.invoices
  add column if not exists rectifies_invoice_id uuid references public.invoices (id),
  add column if not exists rectification_reason text;

-- Permite al propio usuario fijar manualmente el próximo número de una serie
-- (por ejemplo, para continuar la numeración de facturas ya emitidas fuera
-- de la app). No deja fijarlo por debajo del número más alto ya emitido en
-- esa serie, para evitar duplicados.
create or replace function public.set_invoice_counter(p_series text, p_last_number integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_max_issued integer;
begin
  select coalesce(max(number), 0) into v_max_issued
  from public.invoices
  where user_id = auth.uid() and series = p_series;

  if p_last_number < v_max_issued then
    raise exception 'No puedes fijar el contador por debajo del número de factura más alto ya emitido (%) en la serie %.', v_max_issued, p_series;
  end if;

  insert into public.invoice_counters (user_id, series, last_number)
  values (auth.uid(), p_series, p_last_number)
  on conflict (user_id, series) do update set last_number = excluded.last_number;
end;
$$;

grant execute on function public.set_invoice_counter(text, integer) to authenticated;
