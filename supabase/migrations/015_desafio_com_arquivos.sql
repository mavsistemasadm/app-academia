-- ============================================================
-- 015 — Imagem e arquivo no desafio
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
-- Cole o arquivo inteiro e clique em Run. Idempotente: pode rodar de novo.
--
-- O professor pode dar uma cara ao desafio (uma foto de capa) e anexar um
-- arquivo: regulamento, tabela de percurso, cartaz. Bucket público, como o
-- de exercícios, porque nada aqui é dado de saúde; só professor escreve.
-- ============================================================

alter table desafios
  add column if not exists imagem_url text,
  add column if not exists arquivo_url text,
  add column if not exists arquivo_nome text;

insert into storage.buckets (id, name, public)
values ('desafios', 'desafios', true)
on conflict (id) do nothing;

drop policy if exists "leitura_publica_desafios" on storage.objects;
create policy "leitura_publica_desafios" on storage.objects
  for select using (bucket_id = 'desafios');

drop policy if exists "professor_gerencia_desafios_storage" on storage.objects;
create policy "professor_gerencia_desafios_storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'desafios' and public.eh_professor())
  with check (bucket_id = 'desafios' and public.eh_professor());
