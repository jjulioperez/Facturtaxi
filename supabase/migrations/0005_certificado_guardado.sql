-- Facturtaxi: permite guardar el certificado digital (.p12/.pfx) en la
-- cuenta del usuario, para no tener que subirlo cada vez que se firma una
-- factura. NUNCA se guarda la contraseña del certificado en ningún sitio
-- (se sigue pidiendo cada vez que se firma, o se recuerda solo en memoria
-- durante la sesión del navegador, como hasta ahora).

alter table public.profiles
  add column if not exists certificate_path text,
  add column if not exists certificate_filename text;

grant update (certificate_path, certificate_filename) on public.profiles to authenticated;

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

create policy "certificates: owner read" on storage.objects
  for select using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "certificates: owner write" on storage.objects
  for insert with check (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "certificates: owner update" on storage.objects
  for update using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "certificates: owner delete" on storage.objects
  for delete using (bucket_id = 'certificates' and (storage.foldername(name))[1] = auth.uid()::text);
