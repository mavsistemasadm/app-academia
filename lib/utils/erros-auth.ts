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
