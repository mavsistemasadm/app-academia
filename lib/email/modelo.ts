/**
 * O mesmo desenho dos e-mails de convite (docs/emails/invite.html): topo
 * grafite com o logo, card branco, botão ciano. HTML de e-mail é em tabela e
 * estilo inline porque é o único jeito de sair igual no Gmail e no Outlook.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://ctatitudevital.com.br'
).replace(/\/$/, '')

export interface ConteudoEmail {
  titulo: string
  corpo: string
  /** Relativo ao site ("/aulas") ou absoluto. */
  url?: string | null
  botao?: string
  /** Linha pequena abaixo do botão. */
  observacao?: string
}

function escapar(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function urlAbsoluta(url: string) {
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

/** Quebra de linha no texto vira parágrafo no e-mail. */
function paragrafos(corpo: string) {
  return corpo
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:#5C6466;font-size:15px;line-height:1.65;">${escapar(p).replace(/\n/g, '<br>')}</p>`
    )
    .join('')
}

export function renderizarEmail({ titulo, corpo, url, botao, observacao }: ConteudoEmail) {
  const link = url ? urlAbsoluta(url) : null

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Atitude Vital</title>
</head>
<body style="margin:0;padding:0;background:#F3F6F6;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F3F6F6;padding:32px 16px;font-family:Inter,-apple-system,'Helvetica Neue',Arial,sans-serif;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;background:#FFFFFF;border-radius:22px;overflow:hidden;">
          <tr>
            <td style="background:#0F1618;padding:28px 32px;">
              <img src="${SITE_URL}/marca/logo-branca.png" alt="Atitude Vital" width="150" style="display:block;width:150px;max-width:60%;height:auto;border:0;">
              <p style="margin:12px 0 0;color:rgba(255,255,255,.55);font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;">
                Central de Saúde Conectada
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;color:#0F1618;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;">
                ${escapar(titulo)}
              </h1>
              ${paragrafos(corpo)}
              ${
                link
                  ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:12px;">
                <tr>
                  <td style="border-radius:999px;background:#0A8FA3;">
                    <a href="${escapar(link)}" style="display:inline-block;padding:14px 32px;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:600;border-radius:999px;">
                      ${escapar(botao ?? 'Abrir no app')}
                    </a>
                  </td>
                </tr>
              </table>`
                  : ''
              }
              ${
                observacao
                  ? `<p style="margin:26px 0 0;padding-top:20px;border-top:1px solid #E6EBEB;color:#8A9496;font-size:13px;line-height:1.6;">${escapar(observacao)}</p>`
                  : ''
              }
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;color:#8A9496;font-size:12px;line-height:1.6;font-family:Inter,Arial,sans-serif;">
          Atitude Vital · centro de treinamento<br>
          Este e-mail foi enviado automaticamente. Fale com o centro pelo app.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

  const texto = [titulo, '', corpo, ...(link ? ['', `${botao ?? 'Abrir no app'}: ${link}`] : []), ...(observacao ? ['', observacao] : [])].join('\n')

  return { html, texto }
}
