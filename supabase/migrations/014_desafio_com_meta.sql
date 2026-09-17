-- ============================================================
-- 014 — Desafio com meta a alcançar
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
-- Cole o arquivo inteiro e clique em Run. Idempotente: pode rodar de novo.
--
-- Até a 013 o desafio era de pontos por hábito. Agora ele também pode ser
-- "5 km em 30 dias": uma medida, um objetivo e uma barra de progresso.
--
-- Quatro medidas o app já sabe sozinho (treinos, presenças, minutos de
-- treino e litros de água). Quilômetro ele não tem como saber, então o
-- aluno registra na mão, e cada registro vira uma linha em
-- `desafio_registros` — é o mesmo espírito do "postar o treino" do GymRats,
-- só que sem foto e sem virar rede social.
-- ============================================================

alter table desafios
  add column if not exists tipo text not null default 'pontos',
  add column if not exists metrica text,
  add column if not exists objetivo numeric;

alter table desafios drop constraint if exists desafio_tipo_valido;
alter table desafios
  add constraint desafio_tipo_valido check (tipo in ('pontos', 'meta'));

alter table desafios drop constraint if exists desafio_metrica_valida;
alter table desafios
  add constraint desafio_metrica_valida check (
    metrica is null or metrica in ('km', 'minutos', 'treinos', 'presencas', 'litros')
  );

-- Desafio de meta sem medida e sem objetivo não tem como ser medido.
alter table desafios drop constraint if exists desafio_meta_completa;
alter table desafios
  add constraint desafio_meta_completa check (
    tipo <> 'meta' or (metrica is not null and objetivo is not null and objetivo > 0)
  );

-- ============================================================
-- 1. O QUE O ALUNO REGISTRA NA MÃO (hoje só quilômetro)
-- ============================================================

create table if not exists desafio_registros (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null references desafios(id) on delete cascade,
  aluno_id uuid not null references profiles(id) on delete cascade,
  data date not null default current_date,
  quantidade numeric not null check (quantidade > 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists desafio_registros_por_desafio
  on desafio_registros (desafio_id, aluno_id);

alter table desafio_registros enable row level security;

drop policy if exists "aluno_proprios_registros" on desafio_registros;
create policy "aluno_proprios_registros" on desafio_registros
  for all to authenticated
  using (auth.uid() = aluno_id)
  with check (auth.uid() = aluno_id);

drop policy if exists "professor_ve_registros" on desafio_registros;
create policy "professor_ve_registros" on desafio_registros
  for select to authenticated using (public.eh_professor());

-- ============================================================
-- 2. PROGRESSO DE CADA UM
--
-- Mesma ideia do ranking da 013: `security definer` porque precisa somar
-- presença e treino de todo mundo, e devolve só nome abreviado e o número.
-- ============================================================

create or replace function public.progresso_desafio(p_desafio uuid)
returns table (
  aluno_id uuid,
  nome text,
  foto_url text,
  quantidade numeric,
  concluido boolean,
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

  fim_real := least(d.fim, (now() at time zone 'America/Sao_Paulo')::date);

  return query
  with participantes as (
    select p.aluno_id as id, pr.nome, pr.foto_url
    from desafio_participantes p
    join profiles pr on pr.id = p.aluno_id
    where p.desafio_id = p_desafio and p.status = 'ativo'
  ),
  somas as (
    select
      pa.id,
      case d.metrica
        when 'km' then
          coalesce((select sum(r.quantidade) from desafio_registros r
            where r.desafio_id = p_desafio and r.aluno_id = pa.id
              and r.data between d.inicio and fim_real), 0)
        when 'minutos' then
          coalesce((select sum(t.duracao_segundos) / 60.0 from treino_execucoes t
            where t.aluno_id = pa.id and t.concluido
              and t.data between d.inicio and fim_real), 0)
        when 'treinos' then
          coalesce((select count(distinct t.data) from treino_execucoes t
            where t.aluno_id = pa.id and t.concluido
              and t.data between d.inicio and fim_real), 0)
        when 'presencas' then
          coalesce((select count(distinct c.data) from checkins c
            where c.aluno_id = pa.id and c.data between d.inicio and fim_real), 0)
        when 'litros' then
          coalesce((select sum(g.quantidade_ml) / 1000.0 from hidratacao_registros g
            where g.aluno_id = pa.id and g.data between d.inicio and fim_real), 0)
        else 0
      end as total
    from participantes pa
  )
  select
    pa.id,
    case
      when split_part(pa.nome, ' ', 2) = '' then split_part(pa.nome, ' ', 1)
      else split_part(pa.nome, ' ', 1) || ' ' || left(split_part(pa.nome, ' ', 2), 1) || '.'
    end,
    pa.foto_url,
    round(s.total, 2),
    s.total >= coalesce(d.objetivo, 0),
    pa.id = auth.uid()
  from participantes pa
  join somas s on s.id = pa.id
  order by 4 desc, 2 asc;
end;
$$;

revoke all on function public.progresso_desafio(uuid) from public;
grant execute on function public.progresso_desafio(uuid) to authenticated;

-- ============================================================
-- 3. RESUMO DA LISTA, AGORA COM OS DOIS TIPOS
--
-- `meus_pontos` vira "o meu número no desafio": pontos, quando é de pontos;
-- a quantidade da medida, quando é de meta.
-- ============================================================

-- O retorno mudou (numeric e mais uma coluna), e `replace` não aceita isso.
drop function if exists public.resumo_desafios();

create function public.resumo_desafios()
returns table (
  desafio_id uuid,
  participantes int,
  meus_pontos numeric,
  minha_posicao int,
  concluido boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return query
  with visiveis as (
    select d.id, d.tipo
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
    r.valor,
    r.posicao,
    r.concluido
  from visiveis v
  left join lateral (
    select x.valor, x.posicao, x.concluido
    from (
      select
        y.valor,
        y.sou_eu,
        y.concluido,
        (row_number() over (order by y.valor desc))::int as posicao
      from (
        select rd.pontos::numeric as valor, rd.sou_eu, false as concluido
          from public.ranking_desafio(v.id) rd
         where v.tipo = 'pontos'
        union all
        select pd.quantidade, pd.sou_eu, pd.concluido
          from public.progresso_desafio(v.id) pd
         where v.tipo = 'meta'
      ) y
    ) x
    where x.sou_eu
  ) r on true;
end;
$$;

revoke all on function public.resumo_desafios() from public;
grant execute on function public.resumo_desafios() to authenticated;
