#!/usr/bin/env bash
# Aplica migrações no Supabase de produção pela Management API.
#
#   bash scripts/aplicar_migracoes.sh                 # aplica 007 a 010
#   bash scripts/aplicar_migracoes.sh 011_algo 012_x  # aplica as que passar
#
# Precisa de SUPABASE_ACCESS_TOKEN no ambiente (token pessoal da conta
# Supabase). A service role do .env.local não roda DDL. Para no primeiro
# erro e, no fim, confere no banco o que cada migração deveria ter criado.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJETO="vcrrcmekwebbegszewii"
API="https://api.supabase.com/v1/projects/$PROJETO/database/query"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "Falta SUPABASE_ACCESS_TOKEN no ambiente." >&2
  exit 1
fi

sql() {
  # $1 = arquivo com o SQL. Monta o JSON com node para não quebrar aspas.
  node -e 'process.stdout.write(JSON.stringify({query: require("fs").readFileSync(process.argv[1], "utf8")}))' "$1" \
    | curl -sS -X POST "$API" \
        -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        --data @-
}

MIGRACOES=("$@")
if [ ${#MIGRACOES[@]} -eq 0 ]; then
  MIGRACOES=(007_exames 008_duracao_treino 009_realtime_notificacoes 010_alerta_sem_travessao)
fi

for m in "${MIGRACOES[@]}"; do
  arquivo="supabase/migrations/$m.sql"
  [ -f "$arquivo" ] || { echo "Não achei $arquivo" >&2; exit 1; }
  resposta=$(sql "$arquivo")
  if echo "$resposta" | grep -q '"message"'; then
    echo "ERRO em $m: $resposta" >&2
    exit 1
  fi
  echo "ok  $m"
done

echo
echo "Conferindo no banco…"
conferencia=$(mktemp)
cat > "$conferencia" <<'SQL'
select
  to_regclass('public.exames') is not null                         as m007_tabela_exames,
  to_regclass('public.exames_compartilhamentos') is not null       as m007_tabela_links,
  exists(select 1 from storage.buckets where id = 'exames' and not public) as m007_bucket_privado,
  exists(select 1 from information_schema.columns
         where table_name = 'treino_execucoes' and column_name = 'duracao_segundos') as m008_duracao,
  exists(select 1 from pg_publication_tables
         where pubname = 'supabase_realtime' and tablename = 'notificacoes') as m009_realtime,
  position('—' in pg_get_functiondef('public.calcular_semaforo_e_alertar()'::regprocedure)) = 0 as m010_sem_travessao,
  exists(select 1 from pg_trigger where tgname = 'trava_mudanca_de_papel') as m005_trava_papel,
  not exists(select 1 from pg_constraint
             where contype = 'f' and confrelid = 'public.profiles'::regclass
               and confdeltype::text <> 'c') as m006_cascata;
SQL
sql "$conferencia"
echo
rm -f "$conferencia"
