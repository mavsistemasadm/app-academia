-- ============================================================
-- 020 — DOBRAS CUTÂNEAS (JACKSON & POLLOCK, 7 DOBRAS)
--
-- LEMBRETE: aplicar no SQL Editor do Supabase. DDL não roda pela
-- service role (nem pela API, nem pelo script de seed).
--
-- Idempotente: pode rodar mais de uma vez. Só acrescenta colunas,
-- todas opcionais; nenhuma coluna, policy ou gatilho existente muda.
--
-- O app funciona antes e depois desta migração:
--   * antes: a avaliação sem dobras grava igual a hoje; só a seção
--     "Dobras cutâneas" não consegue salvar;
--   * depois: com as 7 dobras o app calcula densidade, % de gordura
--     (Siri), massa gorda e massa magra e grava tudo junto.
--
-- As dobras e a densidade são do professor: a tela do aluno mostra só
-- % de gordura, massa gorda e massa magra.
-- ============================================================

alter table avaliacoes_fisicas
  add column if not exists protocolo_dobras text,
  add column if not exists sexo text,
  add column if not exists idade int,
  add column if not exists dobra_peitoral numeric,
  add column if not exists dobra_axilar_media numeric,
  add column if not exists dobra_triceps numeric,
  add column if not exists dobra_subescapular numeric,
  add column if not exists dobra_abdominal numeric,
  add column if not exists dobra_suprailiaca numeric,
  add column if not exists dobra_coxa numeric,
  add column if not exists soma_dobras numeric,
  add column if not exists densidade_corporal numeric,
  add column if not exists massa_gorda numeric,
  add column if not exists massa_magra numeric;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'avaliacoes_fisicas_sexo_valido'
  ) then
    alter table avaliacoes_fisicas
      add constraint avaliacoes_fisicas_sexo_valido
      check (sexo is null or sexo in ('masculino', 'feminino'));
  end if;
end $$;

comment on column avaliacoes_fisicas.protocolo_dobras is
  'Protocolo das dobras cutâneas; hoje só ''jp7'' (Jackson & Pollock, 7 dobras).';
comment on column avaliacoes_fisicas.sexo is
  'Sexo usado na equação de densidade: masculino ou feminino.';
comment on column avaliacoes_fisicas.idade is
  'Idade em anos no dia da avaliação, usada na equação de densidade.';
comment on column avaliacoes_fisicas.soma_dobras is
  'Soma das 7 dobras, em mm.';
comment on column avaliacoes_fisicas.densidade_corporal is
  'Densidade corporal (g/cm³) pela equação de Jackson & Pollock.';
comment on column avaliacoes_fisicas.massa_gorda is
  'peso × % de gordura, em kg.';
comment on column avaliacoes_fisicas.massa_magra is
  'peso − massa gorda, em kg.';

-- Faz o PostgREST enxergar as colunas novas sem esperar o recarregamento.
notify pgrst, 'reload schema';
