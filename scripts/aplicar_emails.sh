#!/usr/bin/env bash
# Manda para o Supabase os modelos de e-mail da marca (docs/emails/*.html),
# os assuntos em português e as URLs de redirecionamento.
#
#   bash scripts/aplicar_emails.sh
#
# Precisa de SUPABASE_ACCESS_TOKEN no ambiente. Idempotente: rode quantas
# vezes quiser. Não toca em SMTP nem em nada fora de e-mail e URL.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJETO="vcrrcmekwebbegszewii"
SITE="https://app-academia-eta.vercel.app"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Falta SUPABASE_ACCESS_TOKEN no ambiente." >&2
  exit 1
fi

corpo=$(SITE="$SITE" node -e '
const fs = require("fs")
const site = process.env.SITE
const assuntos = JSON.parse(fs.readFileSync("docs/emails/assuntos.json", "utf8"))
const ler = (n) => fs.readFileSync(`docs/emails/${n}.html`, "utf8")

const config = {
  site_url: site,
  // O ** aceita a query ?proximo=… que o app usa depois de confirmar o link.
  uri_allow_list: [`${site}/**`, "http://localhost:3000/**", "http://localhost:3005/**"].join(","),
}

for (const nome of Object.keys(assuntos)) {
  config[`mailer_subjects_${nome}`] = assuntos[nome]
  config[`mailer_templates_${nome}_content`] = ler(nome)
}

process.stdout.write(JSON.stringify(config))
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
  console.log("site_url:", c.site_url)
  console.log("redirect:", c.uri_allow_list)
  for (const k of Object.keys(c).filter((k) => k.startsWith("mailer_subjects_"))) {
    console.log(k.replace("mailer_subjects_", "assunto "), "=", c[k])
  }
})
'
