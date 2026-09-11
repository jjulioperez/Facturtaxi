-- Facturtaxi: campos estructurados del servicio (origen, destino, hora,
-- número de tarifa aplicada y suplementos), además de la descripción libre
-- que ya existía (ahora usada como "observaciones" opcionales). Todos
-- nullable: las facturas ya emitidas sin estos datos siguen funcionando
-- igual, solo se usa la descripción como antes.

alter table public.invoices
  add column if not exists service_origin text,
  add column if not exists service_destination text,
  add column if not exists service_time text,
  add column if not exists tariff_number text,
  add column if not exists supplements text;
