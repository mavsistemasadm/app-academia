-- ============================================================
-- 007 — Exames do aluno e link para o médico
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
-- Cole o arquivo inteiro e clique em Run. Idempotente: pode rodar de novo.
--
-- O aluno sobe o PDF do laboratório ou a imagem do exame, diz o tipo e a
-- data. Quando quiser mostrar ao médico, gera um link com prazo — a página
-- pública lê pelo servidor, com a service role, depois de validar o token.
-- Pela RLS, ninguém anônimo enxerga nada.
-- ============================================================

-- ============================================================
-- 1. EXAMES
-- ============================================================

create table if not exists exames (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles(id) on delete cascade,
  tipo text not null check (tipo in (
    'laboratorial', 'ressonancia', 'ultrassom', 'raio_x', 'tomografia',
    'eletrocardiograma', 'ecocardiograma', 'densitometria', 'outros'
  )),
  -- "Outros" sem dizer o quê não serve para o médico.
  tipo_outro text,
  titulo text,
  data_exame date not null,
  -- Caminho dentro do bucket `exames`: `<aluno_id>/<uuid>-<nome>`.
  arquivo_path text not null,
  arquivo_nome text,
  mime text,
  tamanho_bytes int,
  observacao text,
  created_at timestamptz default now(),
  constraint exames_tipo_outro_obrigatorio check (
    tipo <> 'outros' or coalesce(btrim(tipo_outro), '') <> ''
  )
);

create index if not exists exames_por_aluno_data
  on exames (aluno_id, data_exame desc);

-- ============================================================
-- 2. LINKS DE COMPARTILHAMENTO
--
-- O token sai do navegador com 32 bytes aleatórios (base64url, 43
-- caracteres). O check de tamanho barra token fraco gravado por engano.
-- ============================================================

create table if not exists exames_compartilhamentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles(id) on delete cascade,
  token text not null unique check (char_length(token) >= 43),
  criado_em timestamptz not null default now(),
  expira_em timestamptz,
  revogado boolean not null default false
);

create index if not exists exames_compartilhamentos_por_aluno
  on exames_compartilhamentos (aluno_id, criado_em desc);

-- ============================================================
-- 3. RLS
-- ============================================================

alter table exames enable row level security;
alter table exames_compartilhamentos enable row level security;

drop policy if exists "aluno_proprios_exames" on exames;
create policy "aluno_proprios_exames" on exames
  for all to authenticated
  using (auth.uid() = aluno_id)
  with check (auth.uid() = aluno_id);

drop policy if exists "professor_ve_exames" on exames;
create policy "professor_ve_exames" on exames
  for select to authenticated
  using (public.eh_professor());

-- Só o dono: nem o professor precisa saber quais links existem.
drop policy if exists "aluno_proprios_compartilhamentos" on exames_compartilhamentos;
create policy "aluno_proprios_compartilhamentos" on exames_compartilhamentos
  for all to authenticated
  using (auth.uid() = aluno_id)
  with check (auth.uid() = aluno_id);

-- ============================================================
-- 4. STORAGE — bucket PRIVADO
--
-- Diferente de avatares/exercícios: exame é dado clínico, nunca tem URL
-- pública. Quem abre recebe uma URL assinada que vence.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exames', 'exames', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- O primeiro nível do caminho é o id do dono: `exames/<uid>/arquivo.pdf`.
drop policy if exists "dono_gerencia_proprios_exames" on storage.objects;
create policy "dono_gerencia_proprios_exames" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'exames'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'exames'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "professor_le_exames" on storage.objects;
create policy "professor_le_exames" on storage.objects
  for select to authenticated
  using (bucket_id = 'exames' and public.eh_professor());
