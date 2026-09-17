-- ============================================================
-- 012 — Conta de familiar
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
-- Cole o arquivo inteiro e clique em Run. Idempotente: pode rodar de novo.
--
-- O cadastro aberto saiu: conta de aluno só nasce do convite do professor.
-- Quem recebe um código de acompanhamento de um aluno, porém, não é aluno e
-- não deveria depender do professor. A rota /api/familia/cadastro valida o
-- código e o e-mail do convite e cria a conta com app_metadata.role =
-- 'familiar' (só a service role escreve ali, como o professor na 005).
--
-- Familiar não aparece em nenhuma lista do professor (todas filtram
-- role = 'aluno') e o middleware prende a conta em /acompanhar.
-- ============================================================

alter table public.profiles
  drop constraint if exists profiles_role_valido;
alter table public.profiles
  add constraint profiles_role_valido check (role in ('aluno', 'professor', 'familiar'));

-- Igual à 005, só com o terceiro papel. Na prática o Auth grava o
-- app_metadata depois do insert e o perfil nasce 'aluno'; a rota corrige o
-- papel logo em seguida pela service role. Fica aqui para quem criar a conta
-- com o app_metadata já no insert (SQL direto).
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
    case new.raw_app_meta_data->>'role'
      when 'professor' then 'professor'
      when 'familiar' then 'familiar'
      else 'aluno'
    end,
    v_condicoes
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
