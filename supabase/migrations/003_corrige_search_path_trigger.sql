-- ============================================================
-- Corrige o trigger de criação de perfil
--
-- Uma função `security definer` sem `search_path` fixo roda com o
-- search_path de quem disparou o trigger. No Supabase isso faz o
-- `insert into profiles` não resolver o schema: o trigger falha, o
-- insert em auth.users sofre rollback e o cadastro devolve
-- "Database error saving new user".
--
-- Fixar o search_path também fecha o vetor de escalação de privilégio
-- que o linter do Supabase aponta em funções security definer.
-- ============================================================

o eak