-- ============================================================
-- 017 · Admin da equipe
--
-- APLICAR NO SQL EDITOR DO SUPABASE (DDL não roda pela service role).
--
-- Admin não é um papel novo: é um professor com `eh_admin = true`. Continua
-- vendo tudo que o professor vê (as policies de professor não mudam) e ganha
-- a tela /equipe, onde convida professor ou admin e promove ou rebaixa quem
-- já está na equipe.
--
-- Quem escreve `eh_admin` é a rota /api/equipe pela service role, depois de
-- conferir que quem pediu é admin. Pelo app, com auth.uid(), a trava abaixo
-- recusa, do mesmo jeito que a 005 recusa mudar `role`.
-- ============================================================

alter table public.profiles
  add column if not exists eh_admin boolean not null default false;

-- Admin sem ser professor não faz sentido: a tela de equipe mora no painel.
alter table public.profiles
  drop constraint if exists profiles_admin_eh_professor;
alter table public.profiles
  add constraint profiles_admin_eh_professor
  check (not eh_admin or role = 'professor');

create or replace function public.trava_mudanca_de_papel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem auth.uid() = SQL Editor ou service role. Com ele = alguém pelo app,
  -- inclusive professor: promover conta só pela rota de equipe, que usa a
  -- service role depois de conferir que quem pediu é admin.
  if auth.uid() is not null and (
    new.role is distinct from old.role or
    new.eh_admin is distinct from old.eh_admin
  ) then
    raise exception 'O papel do usuário não pode ser alterado pelo app';
  end if;
  return new;
end;
$$;

drop trigger if exists trava_mudanca_de_papel on public.profiles;
create trigger trava_mudanca_de_papel
  before update on public.profiles
  for each row execute function public.trava_mudanca_de_papel();

-- ------------------------------------------------------------
-- Primeiro admin. Troque o e-mail se for outra pessoa.
-- ------------------------------------------------------------
update public.profiles
   set eh_admin = true
 where email = 'marlos.h.santos@gmail.com'
   and role = 'professor';

-- Confira: deve aparecer uma linha com eh_admin = true.
--   select nome, email, role, eh_admin from profiles where role = 'professor';
