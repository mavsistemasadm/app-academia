-- ============================================================
-- 008 — QUANTO TEMPO O ALUNO LEVOU NO TREINO
--
-- LEMBRETE: aplicar no SQL Editor do Supabase. DDL não roda pela
-- service role (nem pela API, nem pelo script de seed).
--
-- Idempotente: pode rodar mais de uma vez.
--
-- O app funciona antes e depois desta migração:
--   * antes: a duração é estimada pelos `created_at` das séries em
--     `exercicio_execucoes` (primeira série → última série);
--   * depois: o app grava o início (primeira série marcada), a conclusão e
--     a duração em segundos, e o professor vê o tempo exato.
-- ============================================================

alter table treino_execucoes
  add column if not exists iniciado_em timestamptz,
  add column if not exists concluido_em timestamptz,
  add column if not exists duracao_segundos int;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'treino_execucoes_duracao_positiva'
  ) then
    alter table treino_execucoes
      add constraint treino_execucoes_duracao_positiva
      check (duracao_segundos is null or duracao_segundos >= 0);
  end if;
end $$;

comment on column treino_execucoes.iniciado_em is
  'Quando o aluno marcou a primeira série do dia.';
comment on column treino_execucoes.concluido_em is
  'Quando o aluno tocou em concluir treino.';
comment on column treino_execucoes.duracao_segundos is
  'concluido_em - iniciado_em, em segundos, gravado pelo app na conclusão.';

-- Faz o PostgREST enxergar as colunas novas sem esperar o recarregamento.
notify pgrst, 'reload schema';
