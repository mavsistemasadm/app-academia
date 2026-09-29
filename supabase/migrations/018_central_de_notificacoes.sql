-- ============================================================
-- 018 · Central de notificações
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
--
-- Tudo que precisa avisar alguém vira uma linha em `notificacoes_usuario`.
-- A linha diz por onde o aviso sai (`canais`):
--   sino  · aparece no sininho do app
--   push  · notificação no celular
--   email · e-mail com a marca, enviado pelo Resend
--
-- Quem cria as linhas são os gatilhos abaixo (o evento acontece no banco,
-- seja pela tela ou pela API) e o cron. Quem entrega push e e-mail é a rota
-- /api/notificacoes/despachar: o gatilho `despachar_notificacao` chama a rota
-- na hora pelo pg_net, e o cron de 15 minutos varre o que tiver ficado para
-- trás. Por isso uma falha de rede nunca perde aviso, só atrasa.
--
-- A URL da rota e o segredo moram no Vault, fora do código:
--   select vault.create_secret('https://ctatitudevital.com.br/api/notificacoes/despachar', 'notificacoes_url');
--   select vault.create_secret('<o mesmo CRON_SECRET da Vercel>', 'notificacoes_segredo');
-- Sem eles o gatilho não chama nada e o cron entrega sozinho.
--
-- Nenhum gatilho daqui pode derrubar a escrita que o disparou: um erro ao
-- avisar o professor não pode impedir o aluno de registrar a glicemia. Por
-- isso `notificar` engole o erro e só deixa um warning no log.
-- ============================================================

create extension if not exists pg_net with schema extensions;

-- ── 1. A fila ──────────────────────────────────────────────────

create table if not exists public.notificacoes_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.profiles(id) on delete cascade,
  -- Para quem ainda não tem conta (o familiar convidado).
  email_destino text,
  tipo text not null,
  titulo text not null,
  corpo text not null,
  url text,
  urgente boolean not null default false,
  canais text[] not null default '{sino,push}',
  -- Evita repetir o mesmo aviso: (destino, chave) é único quando há chave.
  chave text,
  created_at timestamptz not null default now(),
  -- Controle da entrega. Push é melhor esforço; e-mail tenta até 3 vezes.
  despachando_em timestamptz,
  despachado_em timestamptz,
  push_enviado_em timestamptz,
  email_enviado_em timestamptz,
  tentativas integer not null default 0,
  constraint notificacoes_usuario_tem_destino
    check (usuario_id is not null or email_destino is not null),
  constraint notificacoes_usuario_canais_validos
    check (canais <@ array['sino', 'push', 'email'])
);

create unique index if not exists notificacoes_usuario_chave_unica
  on public.notificacoes_usuario (coalesce(usuario_id::text, email_destino), chave)
  where chave is not null;

create index if not exists notificacoes_usuario_sino
  on public.notificacoes_usuario (usuario_id, created_at desc)
  where 'sino' = any(canais);

create index if not exists notificacoes_usuario_pendentes
  on public.notificacoes_usuario (created_at)
  where despachado_em is null;

alter table public.notificacoes_usuario enable row level security;

-- O usuário só lê as próprias linhas do sininho. Ninguém escreve pelo app:
-- quem insere são as funções security definer e a service role.
drop policy if exists notificacoes_usuario_le_as_suas on public.notificacoes_usuario;
create policy notificacoes_usuario_le_as_suas on public.notificacoes_usuario
  for select using (auth.uid() = usuario_id and 'sino' = any(canais));

do $$
begin
  alter publication supabase_realtime add table public.notificacoes_usuario;
exception when duplicate_object then null;
end $$;

-- ── 2. Funções de apoio ────────────────────────────────────────

create or replace function public.notificar(
  p_usuario uuid,
  p_tipo text,
  p_titulo text,
  p_corpo text,
  p_url text,
  p_canais text[],
  p_chave text default null,
  p_urgente boolean default false,
  p_email_destino text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usuario is null and p_email_destino is null then
    return;
  end if;

  insert into notificacoes_usuario
    (usuario_id, email_destino, tipo, titulo, corpo, url, canais, chave, urgente)
  values
    (p_usuario, p_email_destino, p_tipo, p_titulo, p_corpo, p_url, p_canais, p_chave, p_urgente)
  on conflict do nothing;
exception when others then
  raise warning 'notificar(%): %', p_tipo, sqlerrm;
end;
$$;

revoke all on function public.notificar(uuid, text, text, text, text, text[], text, boolean, text) from public, anon, authenticated;
grant execute on function public.notificar(uuid, text, text, text, text, text[], text, boolean, text) to service_role;

create or replace function public.primeiro_nome(p_usuario uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(split_part(trim(nome), ' ', 1), ''), 'Aluno')
  from profiles where id = p_usuario;
$$;

-- Alunos ativos que um comunicado ou evento alcança.
create or replace function public.alunos_do_publico(p_para_todos boolean, p_condicoes text[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles
  where role = 'aluno'
    and coalesce(ativo, true)
    and (
      p_para_todos is distinct from false
      or coalesce(array_length(p_condicoes, 1), 0) = 0
      or avatar_condicao && p_condicoes
    );
$$;

/*
  Entrega: o despachante pega um lote e marca como "em andamento". Quem
  travou há mais de 10 minutos e não terminou volta para a fila (a função
  caiu no meio). Depois de 3 tentativas a linha desiste.
*/
create or replace function public.pegar_notificacoes_pendentes(p_limite integer default 50)
returns setof public.notificacoes_usuario
language sql
security definer
set search_path = public
as $$
  update notificacoes_usuario n
  set despachando_em = now(), tentativas = n.tentativas + 1
  where n.id in (
    select id from notificacoes_usuario
    where despachado_em is null
      and canais && array['push', 'email']
      and tentativas < 3
      and (despachando_em is null or despachando_em < now() - interval '10 minutes')
    order by created_at
    limit p_limite
    for update skip locked
  )
  returning n.*;
$$;

revoke all on function public.pegar_notificacoes_pendentes(integer) from public, anon, authenticated;
grant execute on function public.pegar_notificacoes_pendentes(integer) to service_role;

-- Chama a rota de entrega assim que a linha nasce. Sem Vault configurado,
-- não faz nada: o cron entrega na próxima volta.
create or replace function public.despachar_notificacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segredo text;
begin
  if not (new.canais && array['push', 'email']) then
    return new;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notificacoes_url';
  select decrypted_secret into v_segredo from vault.decrypted_secrets where name = 'notificacoes_segredo';

  if v_url is null or v_segredo is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_segredo
    ),
    timeout_milliseconds := 10000
  );

  return new;
exception when others then
  raise warning 'despachar_notificacao: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_despachar_notificacao on public.notificacoes_usuario;
create trigger trigger_despachar_notificacao
  after insert on public.notificacoes_usuario
  for each row execute function public.despachar_notificacao();

-- ── 3. Familiar pode receber alerta de indicador crítico ───────
-- Só com consentimento do aluno, que liga na tela de familiares.

alter table public.familiares_acesso
  add column if not exists receber_alertas boolean not null default false;

-- ── 4. Comunicado importante também vai por e-mail ─────────────

alter table public.notificacoes
  add column if not exists importante boolean not null default false;

-- ── 5. Gatilhos: professor ─────────────────────────────────────

-- Todo alerta do professor vira push. O crítico vai também por e-mail e,
-- para os familiares que o aluno autorizou, por e-mail.
-- O sininho do professor já lê `alertas_professor`, por isso sem 'sino'.
create or replace function public.notificar_alerta_professor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := coalesce((select nome from profiles where id = new.aluno_id), 'Aluno');
  v_primeiro text := public.primeiro_nome(new.aluno_id);
  v_titulo text;
  v_corpo text := new.mensagem;
  v_leitura text;
  v_familiar record;
begin
  if new.tipo = 'indicador_vermelho' then
    v_leitura := case new.dados->>'tipo'
      when 'pressao' then 'pressão ' || round((new.dados->>'valor')::numeric)::text || '/' || coalesce(round((new.dados->>'valor2')::numeric)::text, '?')
      when 'glicemia' then 'glicemia ' || round((new.dados->>'valor')::numeric)::text || ' mg/dL'
      when 'saturacao' then 'saturação ' || round((new.dados->>'valor')::numeric)::text || '%'
      when 'fc' then 'frequência cardíaca ' || round((new.dados->>'valor')::numeric)::text || ' bpm'
      else null
    end;
    v_titulo := v_nome || ': indicador crítico';
    if v_leitura is not null then
      v_corpo := v_primeiro || ' registrou ' || v_leitura || '. Verifique antes do treino.';
    end if;
  elsif new.tipo = 'humor_ruim' then
    v_titulo := v_nome || ': como está hoje';
  elsif new.tipo = 'medicamento_nao_tomado' then
    v_titulo := v_nome || ': medicamento';
  elsif new.tipo = 'sem_treinar' then
    v_titulo := v_nome || ': frequência';
  elsif new.tipo = 'treino_no_vermelho' then
    v_titulo := v_nome || ': treinando no vermelho';
  else
    v_titulo := v_nome || ': alerta';
  end if;

  perform public.notificar(
    new.professor_id, 'alerta', v_titulo, v_corpo,
    '/alunos/' || new.aluno_id,
    case when new.tipo in ('indicador_vermelho', 'treino_no_vermelho')
      then array['push', 'email'] else array['push'] end,
    'alerta:' || new.id,
    new.tipo in ('indicador_vermelho', 'treino_no_vermelho')
  );

  if new.tipo = 'indicador_vermelho' then
    for v_familiar in
      select familiar_id from familiares_acesso
      where aluno_id = new.aluno_id and status = 'ativo'
        and receber_alertas and familiar_id is not null
    loop
      perform public.notificar(
        v_familiar.familiar_id, 'alerta_familiar',
        v_primeiro || ' registrou uma medição fora da faixa',
        coalesce('A leitura foi ' || v_leitura || '. ', '') ||
          'O professor da Atitude Vital já foi avisado e vai conversar antes do treino.',
        '/acompanhar',
        array['email'],
        'alerta:' || new.id,
        true
      );
    end loop;
  end if;

  return new;
exception when others then
  raise warning 'notificar_alerta_professor: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_alerta_professor on public.alertas_professor;
create trigger trigger_notificar_alerta_professor
  after insert on public.alertas_professor
  for each row execute function public.notificar_alerta_professor();

-- O aluno decidiu treinar depois de uma medição crítica no portão.
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

  -- Um aviso por dia basta.
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

revoke all on function public.avisar_treino_no_vermelho() from public, anon;
grant execute on function public.avisar_treino_no_vermelho() to authenticated;

-- Aluno preencheu ou atualizou a anamnese.
create or replace function public.notificar_anamnese()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notificar(
    public.professor_responsavel(new.aluno_id), 'anamnese',
    public.primeiro_nome(new.aluno_id) ||
      case when tg_op = 'INSERT' then ' preencheu a anamnese' else ' atualizou a anamnese' end,
    'As respostas já estão na ficha do aluno.',
    '/alunos/' || new.aluno_id,
    array['sino', 'push'],
    'anamnese:' || new.aluno_id || ':' || (now() at time zone 'America/Sao_Paulo')::date
  );
  return new;
exception when others then
  raise warning 'notificar_anamnese: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_anamnese on public.anamneses;
create trigger trigger_notificar_anamnese
  after insert or update on public.anamneses
  for each row execute function public.notificar_anamnese();

-- Aluno enviou um exame.
create or replace function public.notificar_exame()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notificar(
    public.professor_responsavel(new.aluno_id), 'exame',
    public.primeiro_nome(new.aluno_id) || ' enviou um exame',
    coalesce(nullif(new.titulo, ''), 'Exame') ||
      coalesce(' de ' || to_char(new.data_exame, 'DD/MM/YYYY'), '') || '.',
    '/alunos/' || new.aluno_id,
    array['sino'],
    'exame:' || new.id
  );
  return new;
exception when others then
  raise warning 'notificar_exame: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_exame on public.exames;
create trigger trigger_notificar_exame
  after insert on public.exames
  for each row execute function public.notificar_exame();

-- Primeiro acesso de quem foi convidado. O aluno avisa o professor dele; o
-- professor novo avisa os admins.
create or replace function public.notificar_primeiro_acesso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil record;
  v_admin record;
begin
  if old.last_sign_in_at is not null or new.last_sign_in_at is null then
    return new;
  end if;

  select id, nome, role into v_perfil from public.profiles where id = new.id;
  if v_perfil.id is null then
    return new;
  end if;

  if v_perfil.role = 'aluno' then
    perform public.notificar(
      public.professor_responsavel(new.id), 'primeiro_acesso',
      coalesce(v_perfil.nome, 'Aluno') || ' entrou no app',
      'Criou a senha e fez o primeiro acesso.',
      '/alunos/' || new.id,
      array['sino'],
      'primeiro-acesso:' || new.id
    );
  elsif v_perfil.role = 'professor' then
    for v_admin in
      select id from public.profiles
      where eh_admin and id <> new.id and coalesce(ativo, true)
    loop
      perform public.notificar(
        v_admin.id, 'primeiro_acesso',
        coalesce(v_perfil.nome, 'Professor') || ' entrou na equipe',
        'Criou a senha e fez o primeiro acesso ao painel.',
        '/equipe',
        array['sino'],
        'primeiro-acesso:' || new.id
      );
    end loop;
  end if;

  return new;
exception when others then
  raise warning 'notificar_primeiro_acesso: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_primeiro_acesso on auth.users;
create trigger trigger_notificar_primeiro_acesso
  after update of last_sign_in_at on auth.users
  for each row execute function public.notificar_primeiro_acesso();

-- ── 6. Gatilhos: chat (os dois sentidos) ───────────────────────
-- O sininho já lista as não lidas; aqui é só o push.

create or replace function public.notificar_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_texto text := coalesce(nullif(trim(new.texto), ''),
    case when new.audio_url is not null then 'Mensagem de áudio' else 'Nova mensagem' end);
begin
  if new.para is null or new.de is null then
    return new;
  end if;

  perform public.notificar(
    new.para, 'mensagem',
    'Mensagem de ' || public.primeiro_nome(new.de),
    case when length(v_texto) > 140 then left(v_texto, 137) || '...' else v_texto end,
    '/chat/' || new.de,
    array['push'],
    'mensagem:' || new.id
  );
  return new;
exception when others then
  raise warning 'notificar_mensagem: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_mensagem on public.mensagens;
create trigger trigger_notificar_mensagem
  after insert on public.mensagens
  for each row execute function public.notificar_mensagem();

-- ── 7. Gatilhos: aluno ─────────────────────────────────────────

-- Aula cancelada: cada inscrito naquela data recebe push e e-mail. O sininho
-- já mostra a aula cancelada de hoje e amanhã.
create or replace function public.notificar_aula_cancelada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aula record;
  v_inscrito record;
begin
  select titulo, hora, local into v_aula from aulas_horarios where id = new.horario_id;
  if v_aula.titulo is null then
    return new;
  end if;

  for v_inscrito in
    select aluno_id from aula_inscricoes
    where horario_id = new.horario_id and data = new.data
  loop
    perform public.notificar(
      v_inscrito.aluno_id, 'aula_cancelada',
      v_aula.titulo || ' de ' || to_char(new.data, 'DD/MM') || ' foi cancelada',
      'A aula das ' || to_char(v_aula.hora, 'HH24:MI') || ' não vai acontecer, você não precisa vir.' ||
        coalesce(' Motivo: ' || nullif(trim(new.motivo), '') || '.', ''),
      '/aulas',
      array['push', 'email'],
      'aula-cancelada:' || new.id,
      true
    );
  end loop;

  return new;
exception when others then
  raise warning 'notificar_aula_cancelada: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_aula_cancelada on public.aula_cancelamentos;
create trigger trigger_notificar_aula_cancelada
  after insert on public.aula_cancelamentos
  for each row execute function public.notificar_aula_cancelada();

-- Comunicado: push para quem ele alcança; o importante vai também por
-- e-mail. O sininho já lê a tabela `notificacoes`.
create or replace function public.notificar_comunicado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno uuid;
begin
  for v_aluno in select public.alunos_do_publico(new.para_todos, new.avatar_condicao)
  loop
    perform public.notificar(
      v_aluno, 'comunicado', new.titulo,
      case when length(new.corpo) > 400 then left(new.corpo, 397) || '...' else new.corpo end,
      '/agenda',
      case when new.importante then array['push', 'email'] else array['push'] end,
      'comunicado:' || new.id,
      new.importante
    );
  end loop;
  return new;
exception when others then
  raise warning 'notificar_comunicado: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_comunicado on public.notificacoes;
create trigger trigger_notificar_comunicado
  after insert on public.notificacoes
  for each row execute function public.notificar_comunicado();

-- Evento novo na agenda.
create or replace function public.notificar_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno uuid;
begin
  if new.data_inicio < now() then
    return new;
  end if;

  for v_aluno in select public.alunos_do_publico(new.para_todos, new.avatar_condicao)
  loop
    perform public.notificar(
      v_aluno, 'evento',
      'Novo na agenda: ' || new.titulo,
      to_char(new.data_inicio at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') ||
        '. Confirme sua presença pelo app.',
      '/agenda',
      array['sino', 'push'],
      'evento:' || new.id
    );
  end loop;
  return new;
exception when others then
  raise warning 'notificar_evento: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_evento on public.eventos;
create trigger trigger_notificar_evento
  after insert on public.eventos
  for each row execute function public.notificar_evento();

-- Treino novo ou alterado. A chave por dia junta as várias gravações de uma
-- mesma edição num aviso só.
create or replace function public.notificar_treino()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.aluno_id is null or not coalesce(new.ativo, true) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.nome is not distinct from new.nome
     and old.descricao is not distinct from new.descricao
     and old.dia_semana is not distinct from new.dia_semana
     and old.ativo is not distinct from new.ativo then
    return new;
  end if;

  perform public.notificar(
    new.aluno_id, 'treino',
    case when tg_op = 'INSERT' then 'Treino novo: ' else 'Treino atualizado: ' end || new.nome,
    'Seu professor preparou o treino. Dá uma olhada antes de ir.',
    '/treino',
    array['sino', 'push'],
    'treino:' || new.id || ':' || (now() at time zone 'America/Sao_Paulo')::date
  );
  return new;
exception when others then
  raise warning 'notificar_treino: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_treino on public.treinos;
create trigger trigger_notificar_treino
  after insert or update on public.treinos
  for each row execute function public.notificar_treino();

-- Exercício trocado sem mexer no treino em si também conta como alteração.
create or replace function public.notificar_exercicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_treino record;
  v_id uuid := coalesce(new.treino_id, old.treino_id);
begin
  select id, aluno_id, nome, ativo into v_treino from treinos where id = v_id;
  if v_treino.aluno_id is null or not coalesce(v_treino.ativo, true) then
    return coalesce(new, old);
  end if;

  perform public.notificar(
    v_treino.aluno_id, 'treino',
    'Treino atualizado: ' || v_treino.nome,
    'Seu professor ajustou os exercícios. Dá uma olhada antes de ir.',
    '/treino',
    array['sino', 'push'],
    'treino:' || v_treino.id || ':' || (now() at time zone 'America/Sao_Paulo')::date
  );
  return coalesce(new, old);
exception when others then
  raise warning 'notificar_exercicio: %', sqlerrm;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trigger_notificar_exercicio on public.exercicios;
create trigger trigger_notificar_exercicio
  after insert or update or delete on public.exercicios
  for each row execute function public.notificar_exercicio();

-- Avaliação física lançada.
create or replace function public.notificar_avaliacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.notificar(
    new.aluno_id, 'avaliacao',
    'Sua avaliação física chegou',
    'Os números de ' || to_char(new.data, 'DD/MM') || ' já estão na sua evolução, lado a lado com a anterior.',
    '/evolucao',
    array['sino', 'push'],
    'avaliacao:' || new.id
  );
  return new;
exception when others then
  raise warning 'notificar_avaliacao: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_avaliacao on public.avaliacoes_fisicas;
create trigger trigger_notificar_avaliacao
  after insert on public.avaliacoes_fisicas
  for each row execute function public.notificar_avaliacao();

-- Convite para desafio.
create or replace function public.notificar_convite_desafio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if new.status <> 'convidado' then
    return new;
  end if;

  select nome into v_nome from desafios where id = new.desafio_id and not coalesce(cancelado, false);
  if v_nome is null then
    return new;
  end if;

  perform public.notificar(
    new.aluno_id, 'desafio',
    'Convite para o desafio ' || v_nome,
    'Chegou um convite para você. Veja as regras e entre quando quiser.',
    '/desafios/' || new.desafio_id,
    array['sino', 'push'],
    'desafio:' || new.desafio_id
  );
  return new;
exception when others then
  raise warning 'notificar_convite_desafio: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_convite_desafio on public.desafio_participantes;
create trigger trigger_notificar_convite_desafio
  after insert on public.desafio_participantes
  for each row execute function public.notificar_convite_desafio();

-- ── 8. Gatilhos: familiar ──────────────────────────────────────

-- Convite criado: e-mail para o familiar com o link. Convite aceito: o aluno
-- fica sabendo.
create or replace function public.notificar_familiar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aluno text := coalesce((select nome from profiles where id = new.aluno_id), 'Um aluno');
begin
  if tg_op = 'INSERT' and new.status = 'pendente' and new.email is not null then
    perform public.notificar(
      null, 'convite_familiar',
      v_aluno || ' convidou você para acompanhar a saúde',
      'Na Atitude Vital, ' || split_part(v_aluno, ' ', 1) ||
        ' registra indicadores de saúde e a frequência nos treinos. Com o convite você acompanha tudo pelo celular. ' ||
        'Crie seu acesso com este e-mail (' || new.email || ').',
      '/familia?codigo=' || new.codigo,
      array['email'],
      'convite-familiar:' || new.id,
      false,
      new.email
    );
  elsif tg_op = 'UPDATE' and new.status = 'ativo' and old.status is distinct from 'ativo' then
    perform public.notificar(
      new.aluno_id, 'familiar',
      coalesce(nullif(split_part(new.nome, ' ', 1), ''), 'Seu familiar') || ' aceitou o convite',
      'Agora acompanha seus indicadores e sua frequência. Você pode remover o acesso quando quiser.',
      '/familiares',
      array['sino', 'push'],
      'familiar-aceitou:' || new.id
    );
  end if;
  return new;
exception when others then
  raise warning 'notificar_familiar: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trigger_notificar_familiar on public.familiares_acesso;
create trigger trigger_notificar_familiar
  after insert or update on public.familiares_acesso
  for each row execute function public.notificar_familiar();
