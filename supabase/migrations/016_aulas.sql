-- ============================================================
-- 016 — Aulas com horário e vaga (módulo 25)
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
-- Cole o arquivo inteiro e clique em Run. Idempotente: pode rodar de novo.
--
-- O professor monta a grade da semana ("terça, 18h, funcional, 12 vagas") e
-- o aluno marca o dia que quer. A grade é semanal e se repete; o que existe
-- por data é a inscrição do aluno e, quando for o caso, o cancelamento
-- daquela aula específica (feriado, professor doente).
--
-- Vaga é o ponto delicado: dois alunos podem tocar "marcar" no mesmo
-- segundo. Quem garante o limite é o gatilho, não a tela.
-- ============================================================

-- ============================================================
-- 1. GRADE DA SEMANA
-- ============================================================

create table if not exists aulas_horarios (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id) on delete set null,
  titulo text not null check (btrim(titulo) <> ''),
  descricao text,
  -- 0 = domingo, igual ao `extract(dow)` do Postgres e ao getDay() do JS.
  dia_semana int not null check (dia_semana between 0 and 6),
  hora time not null,
  duracao_min int not null default 60 check (duracao_min > 0),
  vagas int not null default 10 check (vagas > 0),
  local text,
  -- Aula só para um grupo (gestantes, 60+): mesma ideia dos eventos.
  para_todos boolean not null default true,
  avatar_condicao text[],
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aulas_horarios_por_dia
  on aulas_horarios (dia_semana, hora);

-- ============================================================
-- 2. INSCRIÇÃO DO ALUNO E CANCELAMENTO DA AULA
-- ============================================================

create table if not exists aula_inscricoes (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references aulas_horarios(id) on delete cascade,
  aluno_id uuid not null references profiles(id) on delete cascade,
  data date not null,
  created_at timestamptz not null default now(),
  -- Desmarcar apaga a linha: a vaga volta na hora e o histórico do aluno é
  -- o que ele de fato frequentou.
  unique (horario_id, aluno_id, data)
);

create index if not exists aula_inscricoes_por_data on aula_inscricoes (data, horario_id);
create index if not exists aula_inscricoes_por_aluno on aula_inscricoes (aluno_id, data desc);

create table if not exists aula_cancelamentos (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references aulas_horarios(id) on delete cascade,
  data date not null,
  motivo text,
  created_at timestamptz not null default now(),
  unique (horario_id, data)
);

-- ============================================================
-- 3. O GATILHO QUE GUARDA A VAGA
--
-- Confere, na hora de inserir: o dia bate com a grade, a aula não foi
-- cancelada, ainda não passou e ainda há vaga. `AULA_LOTADA` e as outras
-- mensagens são lidas pelo app para explicar o que houve.
-- ============================================================

create or replace function public.checa_vaga_da_aula()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  h record;
  ocupadas int;
  agora timestamp;
begin
  select * into h from aulas_horarios where id = new.horario_id;

  if h is null or not h.ativo then
    raise exception 'AULA_INDISPONIVEL';
  end if;

  if extract(dow from new.data)::int <> h.dia_semana then
    raise exception 'AULA_DIA_ERRADO';
  end if;

  if exists (select 1 from aula_cancelamentos c
             where c.horario_id = new.horario_id and c.data = new.data) then
    raise exception 'AULA_CANCELADA';
  end if;

  agora := (now() at time zone 'America/Sao_Paulo');
  if (new.data + h.hora) < agora then
    raise exception 'AULA_JA_PASSOU';
  end if;

  select count(*) into ocupadas
    from aula_inscricoes i
   where i.horario_id = new.horario_id and i.data = new.data;

  if ocupadas >= h.vagas then
    raise exception 'AULA_LOTADA';
  end if;

  return new;
end;
$$;

drop trigger if exists checa_vaga_da_aula on aula_inscricoes;
create trigger checa_vaga_da_aula
  before insert on aula_inscricoes
  for each row execute function public.checa_vaga_da_aula();

-- ============================================================
-- 4. RLS
--
-- A grade é pública entre os autenticados. Quem marcou o quê, não: cada
-- aluno vê a própria inscrição, e o professor vê todas (é ele quem recebe a
-- turma). A contagem de vagas sai da função da seção 5.
-- ============================================================

alter table aulas_horarios enable row level security;
alter table aula_inscricoes enable row level security;
alter table aula_cancelamentos enable row level security;

drop policy if exists "todos_leem_grade" on aulas_horarios;
create policy "todos_leem_grade" on aulas_horarios
  for select to authenticated using (true);

drop policy if exists "professor_gerencia_grade" on aulas_horarios;
create policy "professor_gerencia_grade" on aulas_horarios
  for all to authenticated
  using (public.eh_professor())
  with check (public.eh_professor());

drop policy if exists "todos_leem_cancelamentos" on aula_cancelamentos;
create policy "todos_leem_cancelamentos" on aula_cancelamentos
  for select to authenticated using (true);

drop policy if exists "professor_cancela_aula" on aula_cancelamentos;
create policy "professor_cancela_aula" on aula_cancelamentos
  for all to authenticated
  using (public.eh_professor())
  with check (public.eh_professor());

drop policy if exists "aluno_gerencia_propria_inscricao" on aula_inscricoes;
create policy "aluno_gerencia_propria_inscricao" on aula_inscricoes
  for all to authenticated
  using (auth.uid() = aluno_id)
  with check (auth.uid() = aluno_id);

drop policy if exists "professor_ve_inscricoes" on aula_inscricoes;
create policy "professor_ve_inscricoes" on aula_inscricoes
  for select to authenticated using (public.eh_professor());

-- O professor também tira alguém de uma aula quando precisa remanejar.
drop policy if exists "professor_remove_inscricao" on aula_inscricoes;
create policy "professor_remove_inscricao" on aula_inscricoes
  for delete to authenticated using (public.eh_professor());

-- ============================================================
-- 5. A AGENDA DE UM PERÍODO
--
-- Devolve uma linha por aula que acontece entre duas datas, já com vagas
-- ocupadas e se quem chamou está inscrito. `security definer` só para
-- contar as inscrições dos outros: nenhum nome sai daqui.
-- ============================================================

create or replace function public.aulas_do_periodo(p_inicio date, p_fim date)
returns table (
  horario_id uuid,
  data date,
  titulo text,
  descricao text,
  local text,
  hora time,
  duracao_min int,
  vagas int,
  ocupadas int,
  cancelada boolean,
  motivo_cancelamento text,
  estou_inscrito boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  minhas_condicoes text[];
  sou_professor boolean;
begin
  if p_fim < p_inicio or p_fim - p_inicio > 120 then
    raise exception 'Período inválido';
  end if;

  select coalesce(avatar_condicao, '{}') into minhas_condicoes
    from profiles where id = auth.uid();
  sou_professor := public.eh_professor();

  return query
  select
    h.id,
    d::date,
    h.titulo,
    h.descricao,
    h.local,
    h.hora,
    h.duracao_min,
    h.vagas,
    (select count(*)::int from aula_inscricoes i
      where i.horario_id = h.id and i.data = d::date),
    exists (select 1 from aula_cancelamentos c
             where c.horario_id = h.id and c.data = d::date),
    (select c.motivo from aula_cancelamentos c
      where c.horario_id = h.id and c.data = d::date),
    exists (select 1 from aula_inscricoes i
             where i.horario_id = h.id and i.data = d::date and i.aluno_id = auth.uid())
  from generate_series(p_inicio, p_fim, interval '1 day') d
  join aulas_horarios h
    on h.ativo and h.dia_semana = extract(dow from d)::int
  where
    sou_professor
    or h.para_todos
    or coalesce(array_length(h.avatar_condicao, 1), 0) = 0
    or h.avatar_condicao && minhas_condicoes
  order by 2, 6;
end;
$$;

revoke all on function public.aulas_do_periodo(date, date) from public;
grant execute on function public.aulas_do_periodo(date, date) to authenticated;
