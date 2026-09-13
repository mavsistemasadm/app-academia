import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com a service role: **ignora RLS**. Existe para o que roda sem
 * usuário logado — o cron dos lembretes precisa ler os medicamentos de todo
 * mundo e as assinaturas de push.
 *
 * Só pode ser importado de código que roda no servidor. A chave nunca
 * aparece no bundle porque não tem o prefixo `NEXT_PUBLIC_`; se alguém tentar
 * usar isso num componente cliente, o `process.env` vem vazio e quebra aqui.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !chave) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada. Os lembretes automáticos não funcionam sem ela.'
    )
  }

  return createSupabaseClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
