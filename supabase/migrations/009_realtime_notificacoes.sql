-- ============================================================
-- 009 — Comunicado novo aparece no sininho na hora
--
-- APLICAR NO SQL EDITOR (DDL não roda pela service role).
--
-- O sininho assina inserts em `notificacoes`, mas a 004 só pôs
-- alertas_professor, mensagens e checkins na publicação do Realtime. Sem
-- isto, o comunicado só aparece quando o aluno recarrega a página.
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;
