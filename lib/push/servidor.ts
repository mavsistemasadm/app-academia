import webpush from 'web-push'

import { createServiceClient } from '@/lib/supabase/servico'

export interface CargaPush {
  titulo: string
  corpo: string
  url?: string
  tag?: string
  urgente?: boolean
}

let configurado = false

/**
 * As chaves VAPID identificam o servidor para o navegador. Sem elas o push
 * simplesmente não sai — e é melhor falhar explicando do que em silêncio.
 */
function configurar(): boolean {
  if (configurado) return true

  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  const contato = process.env.VAPID_SUBJECT ?? 'mailto:contato@exemplo.com'

  if (!publica || !privada) return false

  webpush.setVapidDetails(contato, publica, privada)
  configurado = true
  return true
}

/**
 * Envia para um aluno. Assinatura expirada (404/410) é apagada do perfil:
 * insistir num endpoint morto só gera erro em toda rodada do cron.
 */
export async function enviarPush(
  alunoId: string,
  carga: CargaPush
): Promise<boolean> {
  if (!configurar()) return false

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('profiles')
    .select('push_subscription')
    .eq('id', alunoId)
    .maybeSingle()

  const assinatura = data?.push_subscription
  if (!assinatura) return false

  try {
    await webpush.sendNotification(assinatura, JSON.stringify(carga))
    return true
  } catch (erro) {
    const status = (erro as { statusCode?: number }).statusCode

    if (status === 404 || status === 410) {
      await supabase
        .from('profiles')
        .update({ push_subscription: null })
        .eq('id', alunoId)
    }

    return false
  }
}

export async function enviarParaVarios(
  alunoIds: string[],
  carga: CargaPush
): Promise<number> {
  const resultados = await Promise.all(
    alunoIds.map((id) => enviarPush(id, carga))
  )
  return resultados.filter(Boolean).length
}
