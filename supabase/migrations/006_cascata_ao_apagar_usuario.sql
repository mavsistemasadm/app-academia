-- ============================================================
-- 006 — Apagar um usuário não pode falhar por chave estrangeira
--
-- `profiles.id` apontava para `auth.users` sem cascata, e várias tabelas da
-- 001 apontavam para `profiles` também sem. Resultado: Authentication → Users
-- → Delete user parava em "violates foreign key constraint".
--
-- A regra de cada vínculo:
--   cascade   — o dado é do aluno (ou é o próprio alerta): some junto
--   set null  — o dado continua valendo sem o autor (avaliação, comunicado,
--               histórico de treino de um treino que foi apagado)
--
-- Os nomes das constraints não são confiáveis (a 001 não os declara), então
-- cada uma é achada pela coluna no catálogo.
-- ============================================================

create or replace function pg_temp.refaz_fk(
  p_tabela text, p_coluna text, p_alvo text, p_acao text
) returns void
language plpgsql
as $$
declare
  v_nome text;
begin
  for v_nome in
    select c.conname
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
     where c.contype = 'f'
       and c.conrelid = p_tabela::regclass
       and a.attname = p_coluna
  loop
    execute format('alter table %s drop constraint %I', p_tabela, v_nome);
  end loop;

  execute format(
    'alter table %s add constraint %I foreign key (%I) references %s on delete %s',
    p_tabela,
    replace(p_tabela, 'public.', '') || '_' || p_coluna || '_fkey',
    p_coluna, p_alvo, p_acao
  );
end;
$$;

select pg_temp.refaz_fk('public.profiles',                 'id',           'auth.users(id)',       'cascade');

select pg_temp.refaz_fk('public.treino_execucoes',         'aluno_id',     'public.profiles(id)',  'cascade');
select pg_temp.refaz_fk('public.treino_execucoes',         'treino_id',    'public.treinos(id)',   'set null');
select pg_temp.refaz_fk('public.medicamento_confirmacoes', 'aluno_id',     'public.profiles(id)',  'cascade');
select pg_temp.refaz_fk('public.mensagens',                'de',           'public.profiles(id)',  'cascade');
select pg_temp.refaz_fk('public.mensagens',                'para',         'public.profiles(id)',  'cascade');
select pg_temp.refaz_fk('public.alertas_professor',        'aluno_id',     'public.profiles(id)',  'cascade');
select pg_temp.refaz_fk('public.alertas_professor',        'professor_id', 'public.profiles(id)',  'cascade');
select pg_temp.refaz_fk('public.notificacoes',             'professor_id', 'public.profiles(id)',  'set null');
select pg_temp.refaz_fk('public.avaliacoes_fisicas',       'professor_id', 'public.profiles(id)',  'set null');

-- Conferência: nenhuma FK para profiles/auth.users deve sobrar como "a"
-- (no action). Esperado: zero linhas.
select conrelid::regclass as tabela, conname
  from pg_constraint
 where contype = 'f'
   and confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
   and confdeltype = 'a';
