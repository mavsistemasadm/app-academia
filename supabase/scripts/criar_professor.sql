-- ============================================================
-- Promove uma conta existente a professor
--
-- Como rodar:
--   1. Authentication → Users → Add user
--      e-mail: o do professor (troque abaixo também)
--      marque "Auto Confirm User" (sem isso o login recusa)
--   2. Cole este bloco no SQL Editor e execute.
--
-- Roda como `postgres`, então ignora RLS e passa pela trava da migração 005
-- (que só barra quem chega com auth.uid(), ou seja, pelo app).
-- ============================================================

do $$
declare
  v_email text := 'marlos.h.santos@gmail.com';  -- ← troque aqui
  v_id uuid;
begin
  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    raise exception 'Nenhum usuário com e-mail %. Crie em Authentication → Users primeiro.', v_email;
  end if;

  -- Garante o perfil mesmo que o trigger on_auth_user_created tenha falhado.
  insert into public.profiles (id, nome, email, role)
  values (v_id, split_part(v_email, '@', 1), v_email, 'professor')
  on conflict (id) do update set role = 'professor';

  -- Deixa o papel também em app_metadata, de onde o trigger de cadastro lê.
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"professor"}'
   where id = v_id;
end $$;

select id, nome, email, role from public.profiles where email = 'marlos.h.santos@gmail.com';
