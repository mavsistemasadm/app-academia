-- ============================================================
-- 011 — Anamnese com perguntas editáveis pelo professor
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
-- Cole o arquivo inteiro e clique em Run. Idempotente: pode rodar de novo.
--
-- Até aqui as 14 perguntas moravam no código, cada uma numa coluna de
-- `anamneses`. Agora moram em `anamnese_perguntas` e as respostas vão para
-- `anamneses.respostas` (jsonb, chave = id da pergunta).
--
-- As colunas antigas ficam: as perguntas originais apontam para elas por
-- `coluna_legada`, o app continua gravando nelas e lê delas quando a
-- resposta ainda não está no jsonb. Nada precisa ser copiado.
-- ============================================================

-- ============================================================
-- 1. PERGUNTAS
-- ============================================================

create table if not exists anamnese_perguntas (
  id uuid primary key default gen_random_uuid(),
  secao text not null check (btrim(secao) <> ''),
  enunciado text not null check (btrim(enunciado) <> ''),
  -- Exemplo dentro do campo de texto ou explicação embaixo da pergunta.
  ajuda text,
  tipo text not null check (tipo in (
    'texto_curto', 'texto_longo', 'escolha_unica', 'multipla_escolha',
    'sim_nao', 'numero', 'escala', 'data'
  )),
  opcoes text[] not null default '{}',
  obrigatoria boolean not null default false,
  -- Entra na folha mensal que o aluno leva ao médico.
  no_relatorio boolean not null default false,
  ordem int not null default 0,
  -- Pergunta com resposta não se apaga: arquiva, e a ficha segue mostrando.
  ativa boolean not null default true,
  coluna_legada text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anamnese_escolha_tem_opcoes check (
    tipo not in ('escolha_unica', 'multipla_escolha') or cardinality(opcoes) >= 2
  )
);

create index if not exists anamnese_perguntas_ordem
  on anamnese_perguntas (ordem);

alter table anamneses
  add column if not exists respostas jsonb not null default '{}'::jsonb;

-- ============================================================
-- 2. RLS
-- ============================================================

alter table anamnese_perguntas enable row level security;

drop policy if exists "todos_leem_perguntas_anamnese" on anamnese_perguntas;
create policy "todos_leem_perguntas_anamnese" on anamnese_perguntas
  for select to authenticated using (true);

drop policy if exists "professor_edita_perguntas_anamnese" on anamnese_perguntas;
create policy "professor_edita_perguntas_anamnese" on anamnese_perguntas
  for all to authenticated
  using (public.eh_professor())
  with check (public.eh_professor());

-- ============================================================
-- 3. AS 14 PERGUNTAS QUE JÁ EXISTIAM
--
-- Ids fixos, iguais aos de PERGUNTAS_PADRAO em lib/utils/anamnese.ts:
-- antes desta migração o app usa a lista do código com os mesmos ids.
-- `on conflict do nothing` preserva o que o professor já editou.
-- ============================================================

insert into anamnese_perguntas
  (id, secao, enunciado, ajuda, tipo, opcoes, obrigatoria, no_relatorio, ordem, coluna_legada)
values
  ('a0a0a0a0-0000-4000-8000-000000000001', 'Seu objetivo', 'O que você busca no centro?',
   'Controlar a diabetes, ganhar disposição, voltar a subir escada sem cansar…',
   'texto_longo', '{}', true, true, 10, 'objetivo'),
  ('a0a0a0a0-0000-4000-8000-000000000002', 'Histórico de saúde', 'Você tem alguma dessas condições?', null,
   'multipla_escolha', array['Diabetes', 'Hipertensão', 'Colesterol alto', 'Problema cardíaco', 'Asma',
     'Problema de tireoide', 'Artrose / artrite', 'Osteoporose', 'Hérnia de disco', 'Depressão / ansiedade'],
   false, true, 20, 'doencas'),
  ('a0a0a0a0-0000-4000-8000-000000000003', 'Histórico de saúde', 'Lesões: atuais ou antigas',
   'Dor no ombro direito, joelho que trava…', 'texto_curto', '{}', false, true, 30, 'lesoes'),
  ('a0a0a0a0-0000-4000-8000-000000000004', 'Histórico de saúde', 'Cirurgias',
   'Quais e quando', 'texto_curto', '{}', false, false, 40, 'cirurgias'),
  ('a0a0a0a0-0000-4000-8000-000000000005', 'Histórico de saúde', 'Alergias',
   'Medicamentos, alimentos, látex…', 'texto_curto', '{}', false, true, 50, 'alergias'),
  ('a0a0a0a0-0000-4000-8000-000000000006', 'Histórico de saúde', 'Medicamentos em uso',
   'Nome e dose de tudo que você toma', 'texto_curto', '{}', false, true, 60, 'medicamentos_uso'),
  ('a0a0a0a0-0000-4000-8000-000000000007', 'Histórico de saúde', 'Histórico familiar',
   'Infarto, AVC, diabetes na família', 'texto_curto', '{}', false, false, 70, 'historico_familiar'),
  ('a0a0a0a0-0000-4000-8000-000000000008', 'Rotina', 'Você já praticava atividade física?', null,
   'escolha_unica', array['Nunca pratiquei', 'Parei há mais de um ano', 'Parei há alguns meses',
     'Pratico às vezes', 'Pratico toda semana'], false, false, 80, 'pratica_atividade'),
  ('a0a0a0a0-0000-4000-8000-000000000009', 'Rotina', 'Como você dorme?', null,
   'escolha_unica', array['Durmo bem', 'Durmo razoável', 'Durmo mal', 'Tenho insônia'],
   false, false, 90, 'qualidade_sono'),
  ('a0a0a0a0-0000-4000-8000-000000000010', 'Rotina', 'Bebida alcoólica', null,
   'escolha_unica', array['Não bebo', 'Socialmente', 'Toda semana', 'Todo dia'],
   false, false, 100, 'consumo_alcool'),
  ('a0a0a0a0-0000-4000-8000-000000000011', 'Rotina', 'Você fuma?', null,
   'sim_nao', '{}', false, false, 110, 'fumante'),
  ('a0a0a0a0-0000-4000-8000-000000000012', 'Liberação médica', 'Seu médico liberou você para atividade física?', null,
   'sim_nao', '{}', false, false, 120, 'liberado_por_medico'),
  ('a0a0a0a0-0000-4000-8000-000000000013', 'Liberação médica', 'Restrições que o médico passou',
   'Nada de impacto, não passar de 120 bpm…', 'texto_curto', '{}', false, true, 130, 'restricoes_medicas'),
  ('a0a0a0a0-0000-4000-8000-000000000014', 'Liberação médica', 'Mais alguma coisa que devemos saber?',
   'Opcional', 'texto_curto', '{}', false, false, 140, 'observacoes')
on conflict (id) do nothing;
