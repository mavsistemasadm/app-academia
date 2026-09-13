-- ============================================================
-- Lacunas de schema — tudo que os módulos 1, 5, 10, 11, 12, 13,
-- 15, 16, 17 e 18 precisam e o 001 não criou.
--
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================

-- ============================================================
-- 1. QUEM É PROFESSOR (funções auxiliares)
--
-- Uma policy em `profiles` que consulta `profiles` gera recursão
-- infinita. A saída é uma função `security definer`, que roda com o
-- dono da função e por isso não reentra na RLS.
-- ============================================================

create or replace function public.eh_professor(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'professor'
  );
$$;

/*
  O centro é uma unidade só: qualquer professor acompanha qualquer aluno.
  Amarrar a visão do professor à tabela `treinos` (como o 001 fazia)
  esconderia justamente o aluno recém-cadastrado, que ainda não tem treino
  e é quem mais precisa de atenção.
*/

-- ============================================================
-- 2. PERFIS — condição clínica vira lista
--
-- Diabético + hipertenso + 60+ é a combinação mais comum da casa.
-- Guardar uma condição só obrigava a escolher qual doença ignorar.
-- ============================================================

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_condicao'
      and data_type <> 'ARRAY'
  ) then
    alter table public.profiles
      alter column avatar_condicao type text[]
      using case
        when avatar_condicao is null or avatar_condicao = '' then null
        else array[avatar_condicao]
      end;
  end if;
end $$;

alter table public.profiles
  add column if not exists meta_agua_ml int default 2000,
  add column if not exists ativo boolean default true;

-- O trigger de cadastro precisa gravar a lista, não o texto.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_condicoes text[];
begin
  -- O cadastro manda um array JSON; versões antigas mandavam string.
  begin
    v_condicoes := array(
      select jsonb_array_elements_text(
        (new.raw_user_meta_data->'avatar_condicao')::jsonb
      )
    );
  exception when others then
    v_condicoes := case
      when coalesce(new.raw_user_meta_data->>'avatar_condicao', '') = '' then null
      else array[new.raw_user_meta_data->>'avatar_condicao']
    end;
  end;

  if v_condicoes is not null and cardinality(v_condicoes) = 0 then
    v_condicoes := null;
  end if;

  insert into public.profiles (id, nome, email, telefone, role, avatar_condicao)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'telefone', ''),
    coalesce(new.raw_user_meta_data->>'role', 'aluno'),
    v_condicoes
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ============================================================
-- 3. EXECUÇÃO POR SÉRIE (módulos 1 e 5)
-- ============================================================

-- Uma execução por treino por dia — permite upsert ao iniciar o treino.
create unique index if not exists treino_execucoes_unicas
  on treino_execucoes (treino_id, aluno_id, data);

create table if not exists exercicio_execucoes (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references treino_execucoes(id) on delete cascade,
  exercicio_id uuid not null references exercicios(id) on delete cascade,
  aluno_id uuid not null references profiles(id) on delete cascade,
  serie int not null check (serie > 0),
  carga text,
  repeticoes text,
  created_at timestamptz default now(),
  unique (execucao_id, exercicio_id, serie)
);

create index if not exists exercicio_execucoes_por_execucao
  on exercicio_execucoes (execucao_id);

-- ============================================================
-- 3b. CONFIRMAÇÃO DE REMÉDIO SABE QUAL DOSE (módulo 3)
--
-- O 001 só guardava `data_hora`: não dava para saber se o aluno
-- confirmou a dose das 8h ou a das 20h, nem para o professor listar
-- "quem não confirmou". Passamos a gravar dia e horário previsto.
-- ============================================================

alter table medicamento_confirmacoes
  add column if not exists data date,
  add column if not exists horario text;

-- Backfill do que já existe, no fuso da academia.
update medicamento_confirmacoes
  set data = (data_hora at time zone 'America/Sao_Paulo')::date
  where data is null;

/*
  Índice total, não parcial: `on conflict` só sabe inferir um índice parcial
  se a query repetir o mesmo `where`, e o cliente do Supabase não faz isso.
  Linhas antigas com `horario` nulo não atrapalham — no Postgres dois NULLs
  não colidem num índice único.
*/
create unique index if not exists confirmacoes_unicas_por_dose
  on medicamento_confirmacoes (medicamento_id, data, horario);

-- ============================================================
-- 4. CHECK-IN DE PRESENÇA (módulos 12 e 16)
-- ============================================================

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles(id) on delete cascade,
  data date not null default current_date,
  entrada timestamptz not null default now(),
  saida timestamptz,
  origem text default 'app',
  unique (aluno_id, data)
);

create index if not exists checkins_por_data on checkins (data desc);

-- ============================================================
-- 5. ACESSO FAMILIAR (módulo 15)
-- ============================================================

create table if not exists familiares_acesso (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles(id) on delete cascade,
  -- Fica nulo até o familiar aceitar o convite e ter conta.
  familiar_id uuid references profiles(id) on delete set null,
  nome text not null,
  email text not null,
  parentesco text,
  codigo text not null unique,
  status text not null default 'pendente'
    check (status in ('pendente', 'ativo', 'revogado')),
  created_at timestamptz default now(),
  aceito_em timestamptz,
  unique (aluno_id, email)
);

create index if not exists familiares_por_familiar
  on familiares_acesso (familiar_id) where familiar_id is not null;

/*
  Definida aqui, e não junto de `eh_professor`, porque o corpo é `language
  sql`: o Postgres valida a referência a `familiares_acesso` na hora de
  criar a função, então ela precisa vir depois da tabela.
*/
create or replace function public.eh_meu_familiar(dono uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.familiares_acesso fa
    where fa.aluno_id = dono
      and fa.familiar_id = auth.uid()
      and fa.status = 'ativo'
  );
$$;

-- ============================================================
-- 6. ANAMNESE (módulo 17)
-- ============================================================

create table if not exists anamneses (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references profiles(id) on delete cascade,
  doencas text[],
  cirurgias text,
  lesoes text,
  alergias text,
  medicamentos_uso text,
  historico_familiar text,
  pratica_atividade text,
  fumante boolean,
  consumo_alcool text,
  qualidade_sono text,
  objetivo text,
  restricoes_medicas text,
  liberado_por_medico boolean,
  observacoes text,
  atualizado_em timestamptz default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- 7. HIDRATAÇÃO (módulo 18)
-- ============================================================

create table if not exists hidratacao_registros (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references profiles(id) on delete cascade,
  data date not null default current_date,
  quantidade_ml int not null check (quantidade_ml > 0),
  created_at timestamptz default now()
);

create index if not exists hidratacao_por_aluno_data
  on hidratacao_registros (aluno_id, data desc);

-- ============================================================
-- 8. CONQUISTAS (módulo 16)
--
-- As regras são calculadas na aplicação; a tabela existe só para saber
-- *quando* cada uma caiu — é o que permite comemorar a novidade uma vez.
-- ============================================================

create table if not exists aluno_conquistas (
  aluno_id uuid not null references profiles(id) on delete cascade,
  chave text not null,
  conquistada_em timestamptz default now(),
  vista boolean default false,
  primary key (aluno_id, chave)
);

-- ============================================================
-- 9. RLS
-- ============================================================

alter table exercicio_execucoes enable row level security;
alter table checkins enable row level security;
alter table familiares_acesso enable row level security;
alter table anamneses enable row level security;
alter table hidratacao_registros enable row level security;
alter table aluno_conquistas enable row level security;

-- ── Profiles: professor lê e edita os alunos ──────────────────
drop policy if exists "professor_ve_perfis" on profiles;
create policy "professor_ve_perfis" on profiles
  for select using (
    auth.uid() = id
    or public.eh_professor()
    or public.eh_meu_familiar(id)
  );

drop policy if exists "professor_edita_alunos" on profiles;
create policy "professor_edita_alunos" on profiles
  for update using (public.eh_professor());

/*
  O caminho de volta: o aluno precisa ler o perfil do professor para abrir o
  chat e ver com quem está falando. Sem isto a lista de conversas do aluno
  vem vazia. Só expõe as linhas de quem é professor — nenhum dado clínico de
  aluno passa por aqui.
*/
drop policy if exists "todos_veem_professores" on profiles;
create policy "todos_veem_professores" on profiles
  for select to authenticated using (role = 'professor');

-- ── Execução por série ────────────────────────────────────────
drop policy if exists "aluno_proprias_series" on exercicio_execucoes;
create policy "aluno_proprias_series" on exercicio_execucoes
  for all using (auth.uid() = aluno_id);

drop policy if exists "professor_ve_series" on exercicio_execucoes;
create policy "professor_ve_series" on exercicio_execucoes
  for select using (public.eh_professor());

-- ── Check-ins ─────────────────────────────────────────────────
drop policy if exists "aluno_proprios_checkins" on checkins;
create policy "aluno_proprios_checkins" on checkins
  for all using (auth.uid() = aluno_id);

drop policy if exists "professor_ve_checkins" on checkins;
create policy "professor_ve_checkins" on checkins
  for select using (public.eh_professor());

drop policy if exists "familiar_ve_checkins" on checkins;
create policy "familiar_ve_checkins" on checkins
  for select using (public.eh_meu_familiar(aluno_id));

-- ── Familiares ────────────────────────────────────────────────
drop policy if exists "aluno_gerencia_familiares" on familiares_acesso;
create policy "aluno_gerencia_familiares" on familiares_acesso
  for all using (auth.uid() = aluno_id);

drop policy if exists "familiar_ve_proprio_vinculo" on familiares_acesso;
create policy "familiar_ve_proprio_vinculo" on familiares_acesso
  for select using (auth.uid() = familiar_id);

/*
  Aceitar o convite é o único caso em que alguém escreve numa linha que
  não é sua: o familiar carimba o próprio id numa linha pendente. A
  cláusula `with check` impede que ele grave qualquer outra coisa.
*/
drop policy if exists "familiar_aceita_convite" on familiares_acesso;
create policy "familiar_aceita_convite" on familiares_acesso
  for update using (status = 'pendente' and familiar_id is null)
  with check (familiar_id = auth.uid() and status = 'ativo');

-- ── Anamnese ──────────────────────────────────────────────────
drop policy if exists "aluno_propria_anamnese" on anamneses;
create policy "aluno_propria_anamnese" on anamneses
  for all using (auth.uid() = aluno_id);

drop policy if exists "professor_ve_anamnese" on anamneses;
create policy "professor_ve_anamnese" on anamneses
  for select using (public.eh_professor());

-- ── Hidratação ────────────────────────────────────────────────
drop policy if exists "aluno_propria_hidratacao" on hidratacao_registros;
create policy "aluno_propria_hidratacao" on hidratacao_registros
  for all using (auth.uid() = aluno_id);

drop policy if exists "professor_ve_hidratacao" on hidratacao_registros;
create policy "professor_ve_hidratacao" on hidratacao_registros
  for select using (public.eh_professor());

-- ── Conquistas ────────────────────────────────────────────────
drop policy if exists "aluno_proprias_conquistas" on aluno_conquistas;
create policy "aluno_proprias_conquistas" on aluno_conquistas
  for all using (auth.uid() = aluno_id);

drop policy if exists "professor_ve_conquistas" on aluno_conquistas;
create policy "professor_ve_conquistas" on aluno_conquistas
  for select using (public.eh_professor());

-- ── Indicadores, humor, medicamentos, execuções: o professor via
--    função, não via `treinos` ──────────────────────────────────
drop policy if exists "professor_ve_indicadores" on indicadores;
create policy "professor_ve_indicadores" on indicadores
  for select using (
    auth.uid() = aluno_id
    or public.eh_professor()
    or public.eh_meu_familiar(aluno_id)
  );

drop policy if exists "professor_ve_humor" on humor_diario;
create policy "professor_ve_humor" on humor_diario
  for select using (auth.uid() = aluno_id or public.eh_professor());

drop policy if exists "professor_ve_medicamentos" on medicamentos;
create policy "professor_ve_medicamentos" on medicamentos
  for select using (auth.uid() = aluno_id or public.eh_professor());

drop policy if exists "professor_ve_confirmacoes" on medicamento_confirmacoes;
create policy "professor_ve_confirmacoes" on medicamento_confirmacoes
  for select using (auth.uid() = aluno_id or public.eh_professor());

drop policy if exists "professor_ve_execucoes" on treino_execucoes;
create policy "professor_ve_execucoes" on treino_execucoes
  for select using (auth.uid() = aluno_id or public.eh_professor());

-- Confirmação de presença em evento (o 001 criou a tabela sem policy).
alter table evento_confirmacoes enable row level security;

drop policy if exists "aluno_propria_confirmacao_evento" on evento_confirmacoes;
create policy "aluno_propria_confirmacao_evento" on evento_confirmacoes
  for all using (auth.uid() = aluno_id);

drop policy if exists "professor_ve_confirmacoes_evento" on evento_confirmacoes;
create policy "professor_ve_confirmacoes_evento" on evento_confirmacoes
  for select using (public.eh_professor());

-- ============================================================
-- 10. ALERTAS — o gatilho precisa achar um professor
--
-- A versão do 001 só olhava a tabela `treinos`: aluno sem treino
-- gerava indicador vermelho e ninguém era avisado.
-- ============================================================

create or replace function public.professor_responsavel(p_aluno_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select professor_id from treinos
      where aluno_id = p_aluno_id and ativo = true
      order by created_at desc limit 1),
    (select id from profiles
      where role = 'professor'
      order by created_at asc limit 1)
  );
$$;

create or replace function public.calcular_semaforo_e_alertar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semaforo text;
  v_professor_id uuid;
begin
  case new.tipo
    when 'pressao' then
      if new.valor_principal >= 160 or new.valor_secundario >= 100 then v_semaforo := 'vermelho';
      elsif new.valor_principal >= 130 or new.valor_secundario >= 85 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    when 'glicemia' then
      if new.valor_principal >= 200 or new.valor_principal < 70 then v_semaforo := 'vermelho';
      elsif new.valor_principal >= 126 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    when 'saturacao' then
      if new.valor_principal < 90 then v_semaforo := 'vermelho';
      elsif new.valor_principal < 95 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    when 'fc' then
      if new.valor_principal > 100 or new.valor_principal < 50 then v_semaforo := 'vermelho';
      elsif new.valor_principal > 90 then v_semaforo := 'amarelo';
      else v_semaforo := 'verde';
      end if;
    -- Peso continua verde aqui: o critério real é o IMC, que depende da
    -- altura da avaliação física. Quem resolve é lib/utils/indicadores.ts.
    else v_semaforo := 'verde';
  end case;

  new.status_semaforo := v_semaforo;

  if v_semaforo = 'vermelho' then
    v_professor_id := public.professor_responsavel(new.aluno_id);

    if v_professor_id is not null then
      insert into alertas_professor (professor_id, aluno_id, tipo, mensagem, dados)
      values (
        v_professor_id, new.aluno_id, 'indicador_vermelho',
        'Indicador crítico registrado — verificar antes do treino',
        jsonb_build_object(
          'tipo', new.tipo,
          'valor', new.valor_principal,
          'valor2', new.valor_secundario,
          'momento', new.momento
        )
      );
      new.alerta_enviado := true;
    end if;
  end if;

  return new;
end;
$$;

-- Humor ruim também merece alerta.
create or replace function public.alertar_humor_ruim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professor_id uuid;
begin
  if new.humor not in ('enfermo', 'ansioso') then
    return new;
  end if;

  -- Não repete o alerta quando o aluno só troca o emoji no mesmo dia.
  if tg_op = 'UPDATE' and old.humor = new.humor then
    return new;
  end if;

  v_professor_id := public.professor_responsavel(new.aluno_id);

  if v_professor_id is not null then
    insert into alertas_professor (professor_id, aluno_id, tipo, mensagem, dados)
    values (
      v_professor_id, new.aluno_id, 'humor_ruim',
      case new.humor
        when 'enfermo' then 'Aluno se sente mal hoje'
        else 'Aluno relatou ansiedade hoje'
      end,
      jsonb_build_object('humor', new.humor, 'data', new.data)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_humor_alerta on humor_diario;
create trigger trigger_humor_alerta
  after insert or update on humor_diario
  for each row execute function public.alertar_humor_ruim();

-- ============================================================
-- 11. REALTIME
-- ============================================================

do $$
begin
  alter publication supabase_realtime add table alertas_professor;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table mensagens;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table checkins;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- 12. STORAGE — fotos de perfil, vídeos de exercício, remédios
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('avatares', 'avatares', true),
  ('exercicios', 'exercicios', true),
  ('medicamentos', 'medicamentos', true)
on conflict (id) do nothing;

drop policy if exists "leitura_publica_midia" on storage.objects;
create policy "leitura_publica_midia" on storage.objects
  for select using (bucket_id in ('avatares', 'exercicios', 'medicamentos'));

/*
  O primeiro nível do caminho é o id do dono: `avatares/<uid>/foto.jpg`.
  Assim cada um só escreve na própria pasta — menos o professor, que
  publica os vídeos dos exercícios.
*/
drop policy if exists "dono_gerencia_propria_midia" on storage.objects;
create policy "dono_gerencia_propria_midia" on storage.objects
  for all to authenticated
  using (
    bucket_id in ('avatares', 'medicamentos')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatares', 'medicamentos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "professor_gerencia_videos" on storage.objects;
create policy "professor_gerencia_videos" on storage.objects
  for all to authenticated
  using (bucket_id = 'exercicios' and public.eh_professor())
  with check (bucket_id = 'exercicios' and public.eh_professor());
