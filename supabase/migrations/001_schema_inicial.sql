-- ============================================================
-- CENTRAL DE SAÚDE CONECTADA — Schema Inicial
-- Cole esse SQL no SQL Editor do Supabase e execute
-- ============================================================

-- PERFIS
create table if not exists profiles (
  id uuid references auth.users primary key,
  nome text not null,
  email text not null,
  telefone text,
  foto_url text,
  data_nascimento date,
  role text not null default 'aluno',
  avatar_condicao text,
  observacoes_clinicas text,
  familiar_nome text,
  familiar_telefone text,
  medico_nome text,
  medico_telefone text,
  push_subscription jsonb,
  created_at timestamptz default now()
);

-- TREINOS
create table if not exists treinos (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id) on delete cascade,
  aluno_id uuid references profiles(id) on delete cascade,
  nome text not null,
  descricao text,
  dia_semana text[],
  ativo boolean default true,
  created_at timestamptz default now()
);

-- EXERCÍCIOS
create table if not exists exercicios (
  id uuid primary key default gen_random_uuid(),
  treino_id uuid references treinos(id) on delete cascade,
  nome text not null,
  series int,
  repeticoes text,
  carga text,
  descanso text,
  video_url text,
  ordem int default 0,
  observacoes text
);

-- EXECUÇÕES DE TREINO
create table if not exists treino_execucoes (
  id uuid primary key default gen_random_uuid(),
  treino_id uuid references treinos(id),
  aluno_id uuid references profiles(id),
  data date default current_date,
  concluido boolean default false,
  esforco_percebido int check (esforco_percebido between 1 and 10),
  observacao text,
  created_at timestamptz default now()
);

-- MEDICAMENTOS
create table if not exists medicamentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id) on delete cascade,
  nome text not null,
  dose text,
  horarios text[],
  dias_semana text[],
  condicao text,
  foto_url text,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- CONFIRMAÇÕES DE MEDICAMENTO
create table if not exists medicamento_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  medicamento_id uuid references medicamentos(id) on delete cascade,
  aluno_id uuid references profiles(id),
  data_hora timestamptz default now(),
  status text not null check (status in ('tomou', 'nao_tomou', 'adiou')),
  motivo text
);

-- INDICADORES DE SAÚDE
create table if not exists indicadores (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id) on delete cascade,
  tipo text not null check (tipo in ('glicemia', 'pressao', 'peso', 'fc', 'saturacao')),
  valor_principal numeric not null,
  valor_secundario numeric,
  unidade text,
  momento text check (momento in ('jejum', 'pos_refeicao', 'pre_treino', 'pos_treino', 'repouso')),
  status_semaforo text check (status_semaforo in ('verde', 'amarelo', 'vermelho')),
  alerta_enviado boolean default false,
  observacao text,
  created_at timestamptz default now()
);

-- HUMOR DIÁRIO
create table if not exists humor_diario (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id) on delete cascade,
  data date default current_date,
  humor text not null check (humor in ('otimo', 'disposto', 'cansado', 'dormiu_mal', 'enfermo', 'ansioso')),
  qualidade_sono int check (qualidade_sono between 1 and 5),
  observacao text,
  created_at timestamptz default now(),
  unique(aluno_id, data)
);

-- EVENTOS / AGENDA
create table if not exists eventos (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id) on delete cascade,
  titulo text not null,
  descricao text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  para_todos boolean default true,
  avatar_condicao text[],
  created_at timestamptz default now()
);

-- CONFIRMAÇÕES DE EVENTOS
create table if not exists evento_confirmacoes (
  evento_id uuid references eventos(id) on delete cascade,
  aluno_id uuid references profiles(id) on delete cascade,
  confirmado boolean default false,
  primary key (evento_id, aluno_id)
);

-- MENSAGENS (CHAT)
create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  de uuid references profiles(id),
  para uuid references profiles(id),
  texto text,
  audio_url text,
  lida boolean default false,
  created_at timestamptz default now()
);

-- NOTIFICAÇÕES DA ACADEMIA
create table if not exists notificacoes (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id),
  titulo text not null,
  corpo text not null,
  para_todos boolean default true,
  avatar_condicao text[],
  created_at timestamptz default now()
);

-- AVALIAÇÃO FÍSICA
create table if not exists avaliacoes_fisicas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id) on delete cascade,
  professor_id uuid references profiles(id),
  data date default current_date,
  peso numeric,
  altura numeric,
  imc numeric,
  percentual_gordura numeric,
  massa_muscular numeric,
  circunferencia_cintura numeric,
  circunferencia_quadril numeric,
  teste_forca text,
  observacoes text,
  created_at timestamptz default now()
);

-- ALERTAS DO PROFESSOR (tempo real)
create table if not exists alertas_professor (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id),
  aluno_id uuid references profiles(id),
  tipo text not null,
  mensagem text not null,
  dados jsonb,
  resolvido boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table treinos enable row level security;
alter table exercicios enable row level security;
alter table treino_execucoes enable row level security;
alter table medicamentos enable row level security;
alter table medicamento_confirmacoes enable row level security;
alter table indicadores enable row level security;
alter table humor_diario enable row level security;
alter table eventos enable row level security;
alter table evento_confirmacoes enable row level security;
alter table mensagens enable row level security;
alter table notificacoes enable row level security;
alter table avaliacoes_fisicas enable row level security;
alter table alertas_professor enable row level security;

-- Políticas básicas
create policy "usuario_proprio_perfil" on profiles for all using (auth.uid() = id);

create policy "aluno_proprios_indicadores" on indicadores
  for all using (auth.uid() = aluno_id);

create policy "aluno_proprio_humor" on humor_diario
  for all using (auth.uid() = aluno_id);

create policy "aluno_proprios_medicamentos" on medicamentos
  for all using (auth.uid() = aluno_id);

create policy "aluno_proprias_confirmacoes" on medicamento_confirmacoes
  for all using (auth.uid() = aluno_id);

create policy "aluno_proprias_execucoes" on treino_execucoes
  for all using (auth.uid() = aluno_id);

create policy "aluno_ve_treinos" on treinos
  for select using (auth.uid() = aluno_id or auth.uid() = professor_id);

create policy "professor_gerencia_treinos" on treinos
  for all using (auth.uid() = professor_id);

create policy "todos_ve_exercicios" on exercicios
  for select using (
    exists (
      select 1 from treinos t
      where t.id = exercicios.treino_id
      and (t.aluno_id = auth.uid() or t.professor_id = auth.uid())
    )
  );

create policy "professor_gerencia_exercicios" on exercicios
  for all using (
    exists (
      select 1 from treinos t
      where t.id = exercicios.treino_id
      and t.professor_id = auth.uid()
    )
  );

create policy "professor_ve_indicadores" on indicadores
  for select using (
    auth.uid() = aluno_id or
    exists (
      select 1 from treinos t
      where t.professor_id = auth.uid() and t.aluno_id = indicadores.aluno_id
    )
  );

create policy "professor_ve_humor" on humor_diario
  for select using (
    auth.uid() = aluno_id or
    exists (
      select 1 from treinos t
      where t.professor_id = auth.uid() and t.aluno_id = humor_diario.aluno_id
    )
  );

create policy "mensagens_participantes" on mensagens
  for all using (auth.uid() = de or auth.uid() = para);

create policy "alertas_professor_own" on alertas_professor
  for all using (auth.uid() = professor_id);

create policy "todos_ve_eventos" on eventos for select using (true);
create policy "professor_gerencia_eventos" on eventos
  for all using (auth.uid() = professor_id);

create policy "professor_gerencia_notificacoes" on notificacoes
  for all using (auth.uid() = professor_id);
create policy "todos_ve_notificacoes" on notificacoes for select using (true);

create policy "avaliacao_participantes" on avaliacoes_fisicas
  for all using (auth.uid() = aluno_id or auth.uid() = professor_id);

-- ============================================================
-- FUNÇÃO: CALCULAR SEMÁFORO E GERAR ALERTA
-- ============================================================

create or replace function calcular_semaforo_e_alertar()
returns trigger as $$
declare
  v_semaforo text;
  v_professor_id uuid;
begin
  -- Calcular semáforo
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
    else v_semaforo := 'verde';
  end case;

  new.status_semaforo := v_semaforo;

  -- Se vermelho: criar alerta para o professor
  if v_semaforo = 'vermelho' then
    select professor_id into v_professor_id
    from treinos
    where aluno_id = new.aluno_id and ativo = true
    limit 1;

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
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trigger_indicador_semaforo
  before insert on indicadores
  for each row execute function calcular_semaforo_e_alertar();

-- ============================================================
-- TRIGGER: CRIAR PERFIL AUTOMATICAMENTE NO CADASTRO
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'aluno')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- STORAGE BUCKETS
-- (Execute separado no dashboard do Supabase se preferir)
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('videos-treino', 'videos-treino', true),
  ('fotos-perfil', 'fotos-perfil', true),
  ('fotos-medicamentos', 'fotos-medicamentos', true),
  ('exames', 'exames', false)
on conflict do nothing;
