-- ============================================================
-- 019 · Endurece permissões (revisão de entrega)
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
--
-- As policies de "gerenciar" da 001 conferiam só `professor_id = auth.uid()`,
-- nunca se quem grava é professor. Qualquer conta logada (aluno, familiar)
-- conseguia se passar por professor gravando o próprio id nesse campo:
-- criar treino para outro aluno (e com isso sequestrar os alertas dele pelo
-- professor_responsavel), mandar comunicado para a academia inteira, lançar
-- avaliação falsa. Aqui cada escrita passa a exigir eh_professor().
--
-- Nada muda para quem usa o app do jeito normal: as telas já gravam assim.
-- ============================================================

-- ── 1. Treinos e exercícios ────────────────────────────────────

drop policy if exists professor_gerencia_treinos on public.treinos;
create policy professor_gerencia_treinos on public.treinos
  for all to authenticated
  using (public.eh_professor() and professor_id = auth.uid())
  with check (public.eh_professor() and professor_id = auth.uid());

drop policy if exists professor_gerencia_exercicios on public.exercicios;
create policy professor_gerencia_exercicios on public.exercicios
  for all to authenticated
  using (
    public.eh_professor() and exists (
      select 1 from public.treinos t
      where t.id = exercicios.treino_id and t.professor_id = auth.uid()
    )
  )
  with check (
    public.eh_professor() and exists (
      select 1 from public.treinos t
      where t.id = exercicios.treino_id and t.professor_id = auth.uid()
    )
  );

-- O professor do aluno sai de um treino criado por professor de verdade.
create or replace function public.professor_responsavel(p_aluno_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select t.professor_id from treinos t
      join profiles p on p.id = t.professor_id and p.role = 'professor'
      where t.aluno_id = p_aluno_id and t.ativo = true
      order by t.created_at desc limit 1),
    (select id from profiles
      where role = 'professor'
      order by created_at asc limit 1)
  );
$$;

-- ── 2. Agenda e comunicados ────────────────────────────────────

drop policy if exists professor_gerencia_eventos on public.eventos;
create policy professor_gerencia_eventos on public.eventos
  for all to authenticated
  using (public.eh_professor() and professor_id = auth.uid())
  with check (public.eh_professor() and professor_id = auth.uid());

drop policy if exists professor_gerencia_notificacoes on public.notificacoes;
create policy professor_gerencia_notificacoes on public.notificacoes
  for all to authenticated
  using (public.eh_professor() and professor_id = auth.uid())
  with check (public.eh_professor() and professor_id = auth.uid());

-- ── 3. Avaliação física ────────────────────────────────────────
-- O aluno só lê as dele; só professor lança, corrige ou apaga.

drop policy if exists avaliacao_participantes on public.avaliacoes_fisicas;

drop policy if exists avaliacao_leitura on public.avaliacoes_fisicas;
create policy avaliacao_leitura on public.avaliacoes_fisicas
  for select to authenticated
  using (auth.uid() = aluno_id or public.eh_professor());

drop policy if exists avaliacao_professor_lanca on public.avaliacoes_fisicas;
create policy avaliacao_professor_lanca on public.avaliacoes_fisicas
  for insert to authenticated
  with check (public.eh_professor() and professor_id = auth.uid());

drop policy if exists avaliacao_professor_corrige on public.avaliacoes_fisicas;
create policy avaliacao_professor_corrige on public.avaliacoes_fisicas
  for update to authenticated
  using (public.eh_professor())
  with check (public.eh_professor());

drop policy if exists avaliacao_professor_apaga on public.avaliacoes_fisicas;
create policy avaliacao_professor_apaga on public.avaliacoes_fisicas
  for delete to authenticated
  using (public.eh_professor());

-- ── 4. Chat ────────────────────────────────────────────────────
-- Antes, quem participava da conversa podia gravar mensagem "de" outra
-- pessoa e editar ou apagar a do outro lado. Agora: lê quem participa,
-- envia só em nome próprio e sempre com um professor numa das pontas, e o
-- destinatário só consegue marcar como lida.

drop policy if exists mensagens_participantes on public.mensagens;

drop policy if exists mensagens_leitura on public.mensagens;
create policy mensagens_leitura on public.mensagens
  for select to authenticated
  using (auth.uid() = de or auth.uid() = para);

drop policy if exists mensagens_envio on public.mensagens;
create policy mensagens_envio on public.mensagens
  for insert to authenticated
  with check (
    auth.uid() = de
    and para is not null
    and (public.eh_professor() or public.eh_professor(para))
  );

drop policy if exists mensagens_marca_lida on public.mensagens;
create policy mensagens_marca_lida on public.mensagens
  for update to authenticated
  using (auth.uid() = para)
  with check (auth.uid() = para);

revoke update on public.mensagens from authenticated;
grant update (lida) on public.mensagens to authenticated;

-- ── 5. Indicadores ─────────────────────────────────────────────
-- O semáforo é calculado no insert. Com update liberado, o aluno podia
-- trocar o vermelho por verde depois do alerta. O app nunca edita nem
-- apaga medição, então o aluno fica com ler e registrar.

drop policy if exists aluno_proprios_indicadores on public.indicadores;

drop policy if exists aluno_registra_indicador on public.indicadores;
create policy aluno_registra_indicador on public.indicadores
  for insert to authenticated
  with check (auth.uid() = aluno_id);

-- A leitura continua pela policy professor_ve_indicadores (aluno, professor
-- e familiar autorizado).

-- ── 6. Aulas: o prazo de 2 horas vale no banco ─────────────────
-- A tela esconde o "Desmarcar" a menos de 2 h da aula; sem isto, um toque
-- pelo console desmarcava na hora.

drop policy if exists aluno_gerencia_propria_inscricao on public.aula_inscricoes;

drop policy if exists aluno_ve_propria_inscricao on public.aula_inscricoes;
create policy aluno_ve_propria_inscricao on public.aula_inscricoes
  for select to authenticated
  using (auth.uid() = aluno_id);

drop policy if exists aluno_marca_aula on public.aula_inscricoes;
create policy aluno_marca_aula on public.aula_inscricoes
  for insert to authenticated
  with check (auth.uid() = aluno_id);

drop policy if exists aluno_desmarca_aula on public.aula_inscricoes;
create policy aluno_desmarca_aula on public.aula_inscricoes
  for delete to authenticated
  using (
    auth.uid() = aluno_id
    and exists (
      select 1 from public.aulas_horarios h
      where h.id = aula_inscricoes.horario_id
        and ((aula_inscricoes.data + h.hora) at time zone 'America/Sao_Paulo')
            > now() + interval '2 hours'
    )
  );

-- ── 7. A equipe nunca fica sem admin, nem com dois pedidos juntos ─
-- A rota /api/equipe já confere, mas dois admins rebaixando um ao outro no
-- mesmo segundo passavam os dois. O lock serializa os pedidos: o segundo
-- espera o primeiro gravar e aí enxerga que sobraria ninguém.

create or replace function public.garante_um_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not old.eh_admin then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.eh_admin and new.role = 'professor' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('equipe_admins'));

  if not exists (
    select 1 from profiles where eh_admin and id <> old.id
  ) then
    raise exception 'A equipe precisa de pelo menos um admin';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists garante_um_admin on public.profiles;
create trigger garante_um_admin
  before update of eh_admin, role or delete on public.profiles
  for each row execute function public.garante_um_admin();

-- ── 8. Funções de apoio da 018 fora do alcance do app ──────────
-- Eram chamáveis por RPC com a chave pública: listavam alunos, nomes e,
-- pelas condições, quem é diabético, hipertenso etc.

revoke all on function public.primeiro_nome(uuid) from public, anon, authenticated;
revoke all on function public.alunos_do_publico(boolean, text[]) from public, anon, authenticated;
grant execute on function public.primeiro_nome(uuid) to service_role;
grant execute on function public.alunos_do_publico(boolean, text[]) to service_role;

-- "Treinando no vermelho" só vale para aluno que acabou de ter um alerta
-- crítico; antes qualquer conta disparava um alerta urgente por console.
create or replace function public.avisar_treino_no_vermelho()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno uuid := auth.uid();
  v_professor uuid;
begin
  if v_aluno is null then
    return;
  end if;

  if (select role from profiles where id = v_aluno) is distinct from 'aluno' then
    return;
  end if;

  if not exists (
    select 1 from alertas_professor
    where aluno_id = v_aluno and tipo = 'indicador_vermelho'
      and created_at >= now() - interval '12 hours'
  ) then
    return;
  end if;

  if exists (
    select 1 from alertas_professor
    where aluno_id = v_aluno and tipo = 'treino_no_vermelho'
      and created_at >= now() - interval '12 hours'
  ) then
    return;
  end if;

  v_professor := public.professor_responsavel(v_aluno);
  if v_professor is null then
    return;
  end if;

  insert into alertas_professor (professor_id, aluno_id, tipo, mensagem, dados)
  values (
    v_professor, v_aluno, 'treino_no_vermelho',
    'Seguiu para o treino depois de uma medição crítica. Vale conversar antes da primeira série.',
    '{}'::jsonb
  );
end;
$$;

-- ── 9. Alertas das rotinas do cron: um por aluno por dia ───────
-- O cron confere antes de inserir, mas duas voltas sobrepostas (retry da
-- Vercel, chamada manual) passariam as duas.

create unique index if not exists alertas_professor_rotina_por_dia
  on public.alertas_professor (aluno_id, tipo, (dados->>'data'))
  where tipo in ('medicamento_nao_tomado', 'sem_treinar');
