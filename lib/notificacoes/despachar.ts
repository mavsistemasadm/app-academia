import { enviarEmail } from '@/lib/email/enviar'
import { enviarPush } from '@/lib/push/servidor'
import { createServiceClient } from '@/lib/supabase/servico'

/**
 * Entrega a fila de `notificacoes_usuario` (migração 018). Quem chama é a
 * rota /api/notificacoes/despachar, acionada pelo banco no instante em que a
 * linha nasce, e o cron de 15 minutos, que varre o que ficou para trás.
 *
 * Push é melhor esforço: sem assinatura no aparelho não há o que insistir.
 * E-mail que o Resend recusou fica para a próxima volta, até 3 tentativas.
 */

interface Linha {
  id: string
  usuario_id: string | null
  email_destino: string | null
  tipo: string
  titulo: string
  corpo: string
  url: string | null
  urgente: boolean
  canais: string[]
  push_enviado_em: string | null
  email_enviado_em: string | null
  created_at: string
}

/**
 * Aviso que ficou preso na fila (deploy, fora do ar) perde o sentido depois
 * de um tempo: "mensagem de ontem" no celular hoje só confunde. Resumo e
 * convite valem mais tempo que o resto.
 */
const VALIDADE_HORAS: Record<string, number> = {
  convite_familiar: 72,
  resumo_semanal: 48,
  resumo_mensal: 72,
}
const VALIDADE_PADRAO_HORAS = 12

const BOTAO: Record<string, string> = {
  alerta: 'Ver ficha do aluno',
  alerta_familiar: 'Acompanhar',
  aula_cancelada: 'Ver minhas aulas',
  convite_familiar: 'Criar meu acesso',
  resumo_semanal: 'Ver presença',
  resumo_mensal: 'Ver meu relatório',
  conquista: 'Ver minhas conquistas',
  marco: 'Ver minhas conquistas',
}

const OBSERVACAO: Record<string, string> = {
  alerta: 'Você recebe este aviso porque é o professor responsável pelo aluno.',
  alerta_familiar:
    'Você recebe este aviso porque o aluno autorizou alertas para a família. Dá para desligar a qualquer momento no app.',
  convite_familiar:
    'O convite vale até ser usado. Não conhece quem convidou? Pode ignorar este e-mail, nada acontece sem você clicar.',
  resumo_semanal: 'Resumo enviado toda segunda de manhã para a equipe.',
  resumo_mensal: 'Resumo enviado no começo de cada mês. O relatório imprime em PDF para levar ao médico.',
  conquista: 'A equipe da Atitude Vital acompanha cada passo seu.',
  marco: 'A equipe da Atitude Vital acompanha cada passo seu.',
}

async function emailDoUsuario(
  supabase: ReturnType<typeof createServiceClient>,
  usuarioId: string
): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('email').eq('id', usuarioId).maybeSingle()
  if (data?.email) return data.email as string

  const { data: usuario } = await supabase.auth.admin.getUserById(usuarioId)
  return usuario.user?.email ?? null
}

export async function despacharPendentes(limite = 50) {
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('pegar_notificacoes_pendentes', { p_limite: limite })
  if (error) {
    console.error('Fila de notificações indisponível:', error.message)
    return { processadas: 0, push: 0, email: 0, falhas: 0 }
  }

  const resultado = { processadas: 0, push: 0, email: 0, falhas: 0 }

  for (const linha of (data ?? []) as Linha[]) {
    resultado.processadas += 1
    const agora = new Date().toISOString()

    const validade = (VALIDADE_HORAS[linha.tipo] ?? VALIDADE_PADRAO_HORAS) * 3_600_000
    if (Date.now() - Date.parse(linha.created_at) > validade) {
      await supabase.from('notificacoes_usuario').update({ despachado_em: agora }).eq('id', linha.id)
      continue
    }
    const atualizacao: Record<string, string> = {}

    if (linha.canais.includes('push') && !linha.push_enviado_em && linha.usuario_id) {
      const ok = await enviarPush(linha.usuario_id, {
        titulo: linha.titulo,
        corpo: linha.corpo,
        url: linha.url ?? undefined,
        tag: `${linha.tipo}-${linha.id}`,
        urgente: linha.urgente,
      })
      if (ok) resultado.push += 1
      atualizacao.push_enviado_em = agora
    }

    let emailPendente = false
    if (linha.canais.includes('email') && !linha.email_enviado_em) {
      const para =
        linha.email_destino ??
        (linha.usuario_id ? await emailDoUsuario(supabase, linha.usuario_id) : null)

      if (!para) {
        // Sem endereço não adianta tentar de novo.
        atualizacao.email_enviado_em = agora
      } else {
        const ok = await enviarEmail(para, linha.titulo, {
          titulo: linha.titulo,
          corpo: linha.corpo,
          url: linha.url,
          botao: BOTAO[linha.tipo],
          observacao: OBSERVACAO[linha.tipo],
        })
        if (ok) {
          resultado.email += 1
          atualizacao.email_enviado_em = agora
        } else {
          resultado.falhas += 1
          emailPendente = true
        }
      }
    }

    if (!emailPendente) atualizacao.despachado_em = agora

    await supabase.from('notificacoes_usuario').update(atualizacao).eq('id', linha.id)
  }

  return resultado
}
