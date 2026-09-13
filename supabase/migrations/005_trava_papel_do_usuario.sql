-- ============================================================
-- 005 — Ninguém vira professor pelo navegador
--
-- Duas portas estavam abertas, e as duas davam a qualquer pessoa a visão de
-- professor (todos os alunos, todos os dados clínicos):
--
--   1. handle_new_user lia `role` de raw_user_meta_data — que é exatamente o
--      `options.data` do signUp, ou seja, o próprio visitante escreve. Bastava
--      chamar signUp com role 'professor' usando a anon key do bundle.
--   2. A policy "usuario_proprio_perfil" é FOR ALL sem WITH CHECK, então o
--      aluno logado podia rodar update profiles set role = 'professor' na
--      própria linha.
--
-- Agora o papel vem de raw_app_meta_data, que só a service role escreve, e
-- mudar o papel de alguém só é possível fora do app: SQL Editor ou service
-- role (os dois chegam aqui sem auth.uid()).
-- ============================================================

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
    -- app_metadata, nunca user_metadata: só a service role escreve aqui.
    case when new.raw_app_meta_data->>'role' = 'professor' then 'professor' else 'aluno' end,
    v_condicoes
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.trava_mudanca_de_papel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem auth.uid() = SQL Editor ou service role. Com ele = alguém pelo app,
  -- inclusive professor: promover conta não é coisa que se faz por tela.
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'O papel do usuário não pode ser alterado pelo app';
  end if;
  return new;
end;
$$;

drop trigger if exists trava_mudanca_de_papel on public.profiles;
create trigger trava_mudanca_de_papel
  before update on public.profiles
  for each row execute function public.trava_mudanca_de_papel();

alter table public.profiles
  drop constraint if exists profiles_role_valido;
alter table public.profiles
  add constraint profiles_role_valido check (role in ('aluno', 'professor'));

-- Quem já se cadastrou pela brecha aparece aqui. Confira antes de liberar:
--   select id, nome, email, created_at from profiles where role = 'professor';
