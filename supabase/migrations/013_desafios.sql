-- ============================================================
-- 013 — Desafios (módulo 24)
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
-- Cole o arquivo inteiro e clique em Run. Idempotente: pode rodar de novo.
--
-- A ideia é a do GymRats (um período, um ranking, todo mundo junto), só que
-- sem pedir nada a mais do aluno: o ponto sai do que ele já faz no app.
-- Cada hábito conta **uma vez por dia**, e o valor de cada um está em
-- `desafios.regras`, escolhido pelo professor.
--
-- Nada de carga, intensidade ou dado clínico entra na conta: o desafio
-- premia constância e cuidado, que é o que serve para diabético, 60+,
-- cardiopata e gestante sem empurrar ninguém além da conta.
-- ============================================================

-- ============================================================
-- 1. DESAFIOS E PARTICIPANTES
-- ============================================================

create table if not exists desafios (
  id uuid primary key default gen_random_uuid(),
  criado_por uuid references profiles(id) on delete set null,
  nome text not null check (btrim(nome) <> ''),
  descricao text,
  inicio date not null,
  fim date not null,
  -- Aberto: qualquer aluno entra sozinho. Fechado: só quem o professor convida.
  aberto boolean not null default true,
  regras jsonb not null default
    '{"presenca": 10, "treino": 15, "indicador": 5, "agua": 5, "medicamento": 5, "humor": 3}'::jsonb,
  cancelado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint desafio_periodo_valido check (fim >= inicio)
);

create index if not exists desafios_por_periodo on desafios (inicio desc, fim desc);

create table if not exists desafio_participantes (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null references desafios(id) on delete cascade,
  aluno_id uuid not null references profiles(id) on delete cascade,
  -- 'convidado' espera o aluno aceitar; 'saiu' guarda quem desistiu.
  status text not null default 'ativo' check (status in ('convidado', 'ativo', 'saiu')),
  entrou_em timestamptz not null default now(),
  unique (desafio_id, aluno_id)
);

create index if not exists desafio_participantes_por_aluno
  on desafio_participantes (aluno_id);

-- ============================================================
-- 2. RLS
--
-- A tabela de desafios não guarda nada clínico: qualquer autenticado lê.
-- Quem participa de quê, não: cada aluno vê só a própria linha. O ranking
-- sai da função abaixo, que devolve o nome abreviado e os pontos.
-- ============================================================

alter table desafios enable row level security;
alter table desafio_participantes enable row level security;

drop policy if exists "todos_leem_desafios" on desafios;
create policy "todos_leem_desafios" on desafios
  for select to authenticated using (true);

drop policy if exists "professor_gerencia_desafios" on desafios;
create policy "professor_gerencia_desafios" on desafios
  for all to authenticated
  using (public.eh_professor())
  with check (public.eh_professor());

drop policy if exists "professor_gerencia_participantes" on desafio_participantes;
create policy "professor_gerencia_participantes" on desafio_participantes
  for all to authenticated
  using (public.eh_professor())
  with check (public.eh_professor());

drop policy if exists "aluno_ve_propria_inscricao" on desafio_participantes;
create policy "aluno_ve_propria_inscricao" on desafio_participantes
  for select to authenticated using (auth.uid() = aluno_id);

-- Entrar sozinho só em desafio aberto, no ar e não cancelado.
drop policy if exists "aluno_entra_em_desafio_aberto" on desafio_participantes;
create policy "aluno_entra_em_desafio_aberto" on desafio_participantes
  for insert to authenticated
  with check (
    auth.uid() = aluno_id
    and status = 'ativo'
    and exists (
      select 1 from desafios d
      where d.id = desafio_id and d.aberto and not d.cancelado and d.fim >= current_date
    )
  );

-- Aceitar o convite ou sair: só mexe na própria linha.
drop policy if exists "aluno_muda_propria_inscricao" on desafio_participantes;
create policy "aluno_muda_propria_inscricao" on desafio_participantes
  for update to authenticated
  using (auth.uid() = aluno_id)
  with check (auth.uid() = aluno_id and status in ('ativo', 'saiu'));

-- ============================================================
-- 3. RANKING
--
-- `security definer` porque o ranking precisa ler presença, treino e água de
-- todo mundo, e a RLS (com razão) não deixa um aluno ler isso de outro. A
-- função devolve só nome abreviado, foto e pontos, e confere antes se quem
-- chama tem o que fazer ali.
-- ============================================================

create or replace function public.ranking_desafio(p_desafio uuid)
returns table (
  aluno_id uuid,
  nome text,
  foto_url text,
  pontos int,
  dias_ativos int,
  sou_eu boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d record;
  fim_real date;
begin
  select * into d from desafios where id = p_desafio;
  if d is null then
    raise exception 'Desafio não encontrado';
  end if;

  if not (
    public.eh_professor()
    or d.aberto
    or exists (
      select 1 from desafio_participantes p
      where p.desafio_id = p_desafio and p.aluno_id = auth.uid()
    )
  ) then
    raise exception 'Sem acesso a este desafio';
  end if;

  -- Nada conta depois do fim nem antes do começo; hoje é no fuso da academia.
  fim_real := least(d.fim, (now() at time zone 'America/Sao_Paulo')::date);

  return query
  with participantes as (
    select p.aluno_id as id, pr.nome, pr.foto_url, coalesce(pr.meta_agua_ml, 2000) as meta_agua
    from desafio_participantes p
    join profiles pr on pr.id = p.aluno_id
    where p.desafio_id = p_desafio and p.status = 'ativo'
  ),
  dias as (
    select id, data from (
      select c.aluno_id as id, c.data
        from checkins c join participantes on participantes.id = c.aluno_id
       where c.data between d.inicio and fim_real
      union all
      select t.aluno_id, t.data
        from treino_execucoes t join participantes on participantes.id = t.aluno_id
       where t.concluido and t.data between d.inicio and fim_real
      union all
      select i.aluno_id, (i.created_at at time zone 'America/Sao_Paulo')::date
        from indicadores i join participantes on participantes.id = i.aluno_id
       where (i.created_at at time zone 'America/Sao_Paulo')::date between d.inicio and fim_real
      union all
      select m.aluno_id, m.data
        from medicamento_confirmacoes m join participantes on participantes.id = m.aluno_id
       where m.status = 'tomou' and m.data between d.inicio and fim_real
      union all
      select h.aluno_id, h.data
        from humor_diario h join participantes on participantes.id = h.aluno_id
       where h.data between d.inicio and fim_real
      union all
      select g.aluno_id, g.data
        from hidratacao_registros g join participantes on participantes.id = g.aluno_id
       where g.data between d.inicio and fim_real
    ) tudo
  ),
  contagem as (
    select
      pa.id,
      (select count(distinct c.data) from checkins c
        where c.aluno_id = pa.id and c.data between d.inicio and fim_real) as presencas,
      (select count(distinct t.data) from treino_execucoes t
        where t.aluno_id = pa.id and t.concluido and t.data between d.inicio and fim_real) as treinos,
      (select count(distinct (i.created_at at time zone 'America/Sao_Paulo')::date)
         from indicadores i
        where i.aluno_id = pa.id
          and (i.created_at at time zone 'America/Sao_Paulo')::date between d.inicio and fim_real) as indicadores,
      (select count(distinct m.data) from medicamento_confirmacoes m
        where m.aluno_id = pa.id and m.status = 'tomou'
          and m.data between d.inicio and fim_real) as medicamentos,
      (select count(distinct h.data) from humor_diario h
        where h.aluno_id = pa.id and h.data between d.inicio and fim_real) as humores,
      (select count(*) from (
          select g.data from hidratacao_registros g
           where g.aluno_id = pa.id and g.data between d.inicio and fim_real
           group by g.data having sum(g.quantidade_ml) >= pa.meta_agua
        ) dias_na_meta) as aguas,
      (select count(distinct dd.data) from dias dd where dd.id = pa.id) as ativos
    from participantes pa
  )
  select
    pa.id,
    -- "Maria S.": o ranking é entre colegas, não uma lista de nomes completos.
    case
      when split_part(pa.nome, ' ', 2) = '' then split_part(pa.nome, ' ', 1)
      else split_part(pa.nome, ' ', 1) || ' ' || left(split_part(pa.nome, ' ', 2), 1) || '.'
    end,
    pa.foto_url,
    (
      c.presencas * coalesce((d.regras->>'presenca')::int, 0)
      + c.treinos * coalesce((d.regras->>'treino')::int, 0)
      + c.indicadores * coalesce((d.regras->>'indicador')::int, 0)
      + c.medicamentos * coalesce((d.regras->>'medicamento')::int, 0)
      + c.humores * coalesce((d.regras->>'humor')::int, 0)
      + c.aguas * coalesce((d.regras->>'agua')::int, 0)
    )::int,
    c.ativos::int,
    pa.id = auth.uid()
  from participantes pa
  join contagem c on c.id = pa.id
  order by 4 desc, 5 desc, 2 asc;
end;
$$;

revoke all on function public.ranking_desafio(uuid) from public;
grant execute on function public.ranking_desafio(uuid) to authenticated;

-- ============================================================
-- 4. DE ONDE VIERAM MEUS PONTOS
--
-- O ranking diz a posição; esta função diz ao aluno o que rendeu ponto e o
-- que ele ainda pode fazer. Só sobre quem chama, então dispensa checagem de
-- acesso, mas continua `security definer` para ler pelas mesmas regras.
-- ============================================================

create or replace function public.detalhe_pontos_desafio(p_desafio uuid)
returns table (habito text, dias int, pontos_por_dia int, pontos int)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d record;
  fim_real date;
  meta int;
begin
  select * into d from desafios where id = p_desafio;
  if d is null then
    raise exception 'Desafio não encontrado';
  end if;

  fim_real := least(d.fim, (now() at time zone 'America/Sao_Paulo')::date);
  select coalesce(meta_agua_ml, 2000) into meta from profiles where id = auth.uid();

  return query
  with contagem(habito, dias) as (
    select 'presenca', (select count(distinct c.data)::int from checkins c
      where c.aluno_id = auth.uid() and c.data between d.inicio and fim_real)
    union all
    select 'treino', (select count(distinct t.data)::int from treino_execucoes t
      where t.aluno_id = auth.uid() and t.concluido and t.data between d.inicio and fim_real)
    union all
    select 'indicador', (select count(distinct (i.created_at at time zone 'America/Sao_Paulo')::date)::int
      from indicadores i where i.aluno_id = auth.uid()
        and (i.created_at at time zone 'America/Sao_Paulo')::date between d.inicio and fim_real)
    union all
    select 'agua', (select count(*)::int from (
        select g.data from hidratacao_registros g
         where g.aluno_id = auth.uid() and g.data between d.inicio and fim_real
         group by g.data having sum(g.quantidade_ml) >= meta
      ) na_meta)
    union all
    select 'medicamento', (select count(distinct m.data)::int from medicamento_confirmacoes m
      where m.aluno_id = auth.uid() and m.status = 'tomou' and m.data between d.inicio and fim_real)
    union all
    select 'humor', (select count(distinct h.data)::int from humor_diario h
      where h.aluno_id = auth.uid() and h.data between d.inicio and fim_real)
  )
  select
    contagem.habito,
    contagem.dias,
    coalesce((d.regras->>contagem.habito)::int, 0),
    contagem.dias * coalesce((d.regras->>contagem.habito)::int, 0)
  from contagem
  order by 4 desc, 1;
end;
$$;

revoke all on function public.detalhe_pontos_desafio(uuid) from public;
grant execute on function public.detalhe_pontos_desafio(uuid) to authenticated;

-- ============================================================
-- 5. RESUMO PARA A LISTA
--
-- A lista do aluno precisa de quantos participam e de onde ele está, mas a
-- RLS (de novo, com razão) esconde a inscrição dos outros. Uma chamada só,
-- em vez de um ranking por desafio.
-- ============================================================

create or replace function public.resumo_desafios()
returns table (desafio_id uuid, participantes int, meus_pontos int, minha_posicao int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with visiveis as (
    select d.id
    from desafios d
    where not d.cancelado
      and (
        public.eh_professor()
        or d.aberto
        or exists (
          select 1 from desafio_participantes p
          where p.desafio_id = d.id and p.aluno_id = auth.uid()
        )
      )
  )
  select
    v.id,
    (select count(*)::int from desafio_participantes p
      where p.desafio_id = v.id and p.status = 'ativo'),
    r.pontos,
    r.posicao
  from visiveis v
  left join lateral (
    select x.pontos, x.posicao
    from (
      select
        rd.pontos,
        rd.sou_eu,
        (row_number() over (order by rd.pontos desc, rd.dias_ativos desc, rd.nome))::int as posicao
      from public.ranking_desafio(v.id) rd
    ) x
    where x.sou_eu
  ) r on true;
end;
$$;

revoke all on function public.resumo_desafios() from public;
grant execute on function public.resumo_desafios() to authenticated;
