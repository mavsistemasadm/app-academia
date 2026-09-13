-- ============================================================
-- Cadastro: gravar telefone e condição clínica no perfil
--
-- A versão original de handle_new_user só copiava nome/email/role do
-- metadata. Quando a confirmação de e-mail está ligada, o signUp não
-- devolve sessão, então o app não consegue completar o perfil depois
-- (RLS exige auth.uid()). O trigger passa a ler os campos restantes.
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, nome, email, telefone, role, avatar_condicao)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'telefone', ''),
    coalesce(new.raw_user_meta_data->>'role', 'aluno'),
    nullif(new.raw_user_meta_data->>'avatar_condicao', '')
  );
  return new;
end;
$$ language plpgsql security definer;

-- O trigger on_auth_user_created já existe e aponta para esta função.
