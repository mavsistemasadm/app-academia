# Atitude Vital · Central de Saúde Conectada

PWA de saúde do centro de treinamento Atitude Vital. O aluno registra
indicadores, medicamentos, humor, água e treinos; o professor acompanha tudo
em tempo real e recebe alerta quando algo sai da faixa segura.

Produção: **https://ctatitudevital.com.br**

- `CLAUDE.md` é o mapa completo do projeto: módulos, tabelas, regras de fuso,
  de segurança e de design. Leia antes de mexer.
- `docs/DESIGN.md` é a linguagem visual.
- `docs/NOTIFICACOES.md` lista cada aviso que o app manda (sino, push, e-mail).

## Stack

Next.js 16 (App Router, React 19) · TypeScript · Supabase (Postgres, Auth,
Storage, Realtime) · Tailwind + shadcn/ui · Vercel (deploy e cron) · Web Push ·
Resend (e-mail).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
npm run lint
```

## Onde cada coisa está configurada

| O quê | Onde |
|---|---|
| Código | GitHub, branch `main` (a Vercel publica a cada push) |
| Hospedagem e cron | Vercel, projeto `app-academia`; cron em `vercel.json` a cada 15 min |
| Banco, login, arquivos | Supabase |
| Domínio | Registro.br: `A` na raiz → `76.76.21.21`, `www` → `cname.vercel-dns.com`, registros do Resend em `*.envio` |
| E-mail | Resend, domínio `envio.ctatitudevital.com.br`; SMTP do Supabase ligado por `scripts/aplicar_smtp.sh` |

As variáveis de ambiente estão todas em `.env.example`, com o que cada uma faz.

## Banco de dados

As migrações ficam em `supabase/migrations/` e são aplicadas **em ordem**, da
001 à última, no SQL Editor do Supabase. Com um token pessoal no terminal dá
para aplicar pela API:

```bash
export SUPABASE_ACCESS_TOKEN=...   # Account → Access Tokens
bash scripts/aplicar_migracoes.sh 019_endurece_permissoes
```

O script lê o projeto de `NEXT_PUBLIC_SUPABASE_URL` no `.env.local`.

Depois da 018, crie no Vault (SQL Editor) os dois segredos da entrega de
notificações:

```sql
select vault.create_secret('https://ctatitudevital.com.br/api/notificacoes/despachar', 'notificacoes_url');
select vault.create_secret('<o mesmo CRON_SECRET da Vercel>', 'notificacoes_segredo');
```

### Primeiro professor e admin

A conta nova sempre nasce aluno. Para promover a professor, use
`supabase/scripts/criar_professor.sql` (troque o e-mail). Admin é professor com
`eh_admin = true`; a partir do primeiro, os outros são convidados pela tela
`/equipe`.

### E-mails de conta (convite, esqueci a senha)

```bash
bash scripts/aplicar_emails.sh   # modelos de docs/emails, assuntos e URLs
bash scripts/aplicar_smtp.sh     # SMTP do Resend (domínio precisa estar "verified")
```

## Dados de teste

`node supabase/scripts/popular_dados_teste.mjs --confirmo` cria uma academia
de mentira (contas `@teste.local`, senha `teste1234`). **Use num projeto de
testes**: o `.env.local` aponta para produção, e os eventos semeados mandam push
para os alunos reais. `apagar_dados_teste.mjs` só lista; com `--apagar` remove.

## Vídeo de boas-vindas

`public/boas-vindas.mp4` abre no primeiro acesso de cada pessoa, antes do tour.
Para trocar, converta para H.264 (o `.mov` do iPhone não toca no Android):

```bash
ffmpeg -i novo.mov -vf "scale=720:-2,format=yuv420p" -c:v libx264 -crf 26 \
  -c:a aac -b:a 128k -movflags +faststart public/boas-vindas.mp4
ffmpeg -ss 1 -i public/boas-vindas.mp4 -frames:v 1 public/boas-vindas.jpg
```

Quem já viu não vê de novo. Para mostrar a todos outra vez, troque a chave
`CHAVE_VIDEO_VISTO` em `components/shared/VideoBoasVindas.tsx` (ex.: `-v2`).
