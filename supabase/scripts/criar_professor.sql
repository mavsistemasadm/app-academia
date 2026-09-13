-- ============================================================
-- Promove uma conta existente a professor
--
-- Como rodar:
--   1. Authentication → Users → Add user
--      e-mail: marlos.h.santos@gmail.com
--      marque "Auto Confirm User" (sem isso o login recusa)
--   2. Cole este bloco no SQL Editor e execute.
--
-- Roda como `postgres`, então ignora RLS.
-- ============================================================

-- Garante o perfil mesmo que o trigger on_auth_user_created tenha falhado.


