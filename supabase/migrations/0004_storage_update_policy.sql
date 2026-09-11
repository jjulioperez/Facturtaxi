-- Facturtaxi: permite sobrescribir (upsert) el PDF de una factura ya
-- existente en Storage. Sin esta política, subir con upsert:true fallaba
-- si el archivo ya existía en esa ruta (reintentos, o al reutilizar un
-- número tras fijar manualmente el contador hacia atrás).

create policy "invoices: owner update" on storage.objects
  for update using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
