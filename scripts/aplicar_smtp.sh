#!/usr/bin/env bash
# Liga o SMTP próprio do Supabase no Resend, para os e-mails de convite e de
# "esqueci a senha" saírem de nao-responda@envio.ctatitudevital.com.br e sem o
# limite de envio do SMTP embutido do Supabase.
#
#   bash scripts/aplicar_smtp.sh
#
# Precisa de SUPABASE_ACCESS_TOKEN no ambiente e de RESEND_API_KEY no
# .env.local (chave só de envio, restrita ao domínio envio.ctatitudevital.com.br).
# Só rode depois que o domínio estiver "verified" no Resend: com ele pendente o
# Resend recusa o remetente e nenhum convite chega.
set -euo pipefail

cd "$(dirname "$0")/.."

# O projeto sai da URL do Supabase no .env.local: o script mexe sempre no
# mesmo banco que o app usa, nunca num id esquecido no código.
PROJETO=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local 2>/dev/null | sed -E 's#.*https://([^.]+)\.supabase\.co.*#\1#')
if [ -z "$PROJETO" ]; then
  echo "Não achei NEXT_PUBLIC_SUPABASE_URL no .env.local." >&2
  exit 1
fi
REMETENTE="nao-responda@envio.ctatitudevital.com.br"
NOME="Atitude Vital"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Falta SUPABASE_ACCESS_TOKEN no ambiente." >&2
  exit 1
fi

CHAVE=$(grep '^RESEND_API_KEY=' .env.local | cut -d= -f2- | tr -d '"')
if [ -z "$CHAVE" ]; then
  echo "Falta RESEND_API_KEY no .env.local." >&2
  exit 1
fi

corpo=$(REMETENTE="$REMETENTE" NOME="$NOME" CHAVE="$CHAVE" node -e '
process.stdout.write(JSON.stringify({
  smtp_admin_email: process.env.REMETENTE,
  smtp_sender_name: process.env.NOME,
  smtp_host: "smtp.resend.com",
  smtp_port: "465",
  smtp_user: "resend",
  smtp_pass: process.env.CHAVE,
  // O padrão do SMTP embutido é 2 por hora; com SMTP próprio dá para convidar a turma.
  rate_limit_email_sent: 100,
}))
')

resposta=$(curl -sS -X PATCH "https://api.supabase.com/v1/projects/$PROJETO/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data "$corpo")

echo "$resposta" | node -e '
let s = ""
process.stdin.on("data", (d) => (s += d)).on("end", () => {
  const c = JSON.parse(s)
  if (c.message) { console.error("ERRO:", c.message); process.exit(1) }
  console.log("smtp:", c.smtp_host + ":" + c.smtp_port, "como", c.smtp_sender_name, "<" + c.smtp_admin_email + ">")
  console.log("limite por hora:", c.rate_limit_email_sent)
})
'
