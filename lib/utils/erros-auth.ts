import type { AuthError } from '@supabase/supabase-js'

/**
 * O Supabase Auth devolve mensagens em inglês. Como o app é usado por
 * pacientes, traduzimos para algo acionável em português.
 */
const MENSAGENS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos. Confira e tente de novo.'],
  [/email not confirmed/i, 'Você ainda não confirmou seu e-mail. Verifique sua caixa de entrada.'],
  [/user already registered|already been registered/i, 'Esse e-mail já tem cadastro. Faça login.'],
  [/password should be at least/i, 'A senha precisa ter no mínimo 6 caracteres.'],
  [/unable to validate email|invalid format/i, 'E-mail inválido. Verifique o endereço digitado.'],
  [/email rate limit|over_email_send_rate_limit/i, 'Muitas tentativas seguidas. Aguarde alguns minutos.'],
  [/for security purposes.*(\d+) seconds/i, 'Aguarde alguns segundos antes de tentar novamente.'],
  [/should be different from the old password|same_password/i, 'A nova senha precisa ser diferente da atual.'],
  [/auth session missing|session.*expired/i, 'O link expirou. Peça um novo em "Esqueci a senha".'],
  [/failed to fetch|network/i, 'Sem conexão com o servidor. Verifique sua internet.'],
]

export function traduzirErroAuth(mensagem?: string): string {
  if (!mensagem) return 'Não foi possível concluir. Tente novamente.'

  for (const [padrao, traducao] of MENSAGENS) {
    if (padrao.test(mensagem)) return traducao
  }

  return 'Não foi possível concluir. Tente novamente em instantes.'
}

/** O Auth recusou criar a conta porque o e-mail já está cadastrado. */
export function emailJaCadastrado(erro: { code?: string; message?: string }): boolean {
  return (
    erro.code === 'email_exists' ||
    erro.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(erro.message ?? '')
  )
}

/** Erro do convite por e-mail (auth.admin), já com o status HTTP da resposta. */
export function traduzirErroConvite(error: AuthError): { mensagem: string; status: number } {
  const codigo = error.code ?? ''
  const texto = error.message ?? ''

  if (
    error.status === 429 ||
    /rate_limit/.test(codigo) ||
    /rate limit|too many/i.test(texto)
  ) {
    return {
      mensagem:
        'O limite de e-mails do Supabase foi atingido. Aguarde alguns minutos e tente de novo.',
      status: 429,
    }
  }

  if (
    codigo === 'email_address_invalid' ||
    codigo === 'validation_failed' ||
    /invalid.*email|unable to validate email|invalid format/i.test(texto)
  ) {
    return { mensagem: 'E-mail inválido. Confira o endereço digitado.', status: 400 }
  }

  if (
    codigo === 'email_address_not_authorized' ||
    /not authorized/i.test(texto)
  ) {
    return {
      mensagem:
        'O Supabase recusou esse endereço. Configure um SMTP próprio no painel para enviar a qualquer e-mail.',
      status: 400,
    }
  }

  return {
    mensagem: 'Não foi possível enviar o convite agora. Tente novamente em instantes.',
    status: 500,
  }
}
