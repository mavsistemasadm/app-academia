import { renderizarEmail, type ConteudoEmail } from './modelo'

const REMETENTE = 'Atitude Vital <nao-responda@envio.ctatitudevital.com.br>'

/**
 * Endereço que não existe de verdade. Os dados de teste usam `@teste.local`;
 * mandar para lá só gera devolução e suja a reputação do domínio no Resend.
 */
function enderecoDeTeste(email: string) {
  return /\.(local|test|example|invalid)$/i.test(email.split('@')[1] ?? '')
}

/**
 * Envia pelo Resend com a chave só de envio (RESEND_API_KEY). Devolve true
 * quando o Resend aceitou, ou quando o endereço é de teste e foi pulado de
 * propósito: nos dois casos não há por que tentar de novo.
 */
export async function enviarEmail(
  para: string,
  assunto: string,
  conteudo: ConteudoEmail
): Promise<boolean> {
  if (enderecoDeTeste(para)) return true

  const chave = process.env.RESEND_API_KEY
  if (!chave) {
    console.error('RESEND_API_KEY não configurada; e-mail não enviado.')
    return false
  }

  const { html, texto } = renderizarEmail(conteudo)

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: REMETENTE, to: [para], subject: assunto, html, text: texto }),
    })

    if (!resposta.ok) {
      console.error('Resend recusou o e-mail:', resposta.status, await resposta.text())
      return false
    }
    return true
  } catch (erro) {
    console.error('Falha ao falar com o Resend:', erro)
    return false
  }
}
