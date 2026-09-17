# CENTRAL DE SAÚDE CONECTADA
## Instruções para o Claude no VS Code

---

## O QUE É ESSE PROJETO

PWA (Progressive Web App) de saúde para um centro de treinamento personalizado que atende populações especiais: diabéticos, hipertensos, 60+, colesterol, menopausa, performance, adolescentes, gestantes, cardiopatas e obesos.

O objetivo central: **o aluno sentir que está sendo cuidado 24h por dia pelo centro**.

---

## STACK

- **Next.js 14** com App Router e TypeScript
- **Supabase** — banco PostgreSQL, auth, storage, realtime
- **Tailwind CSS** + **shadcn/ui**
- **Vercel** para deploy
- **Web Push API** para notificações PWA

---

## ESTRUTURA DE PASTAS

Todas as rotas abaixo existem e compilam.

```
app/
  layout.tsx              metadata do PWA + registro do service worker
  manifest.ts             manifest do PWA (rota /manifest.webmanifest)
  offline/                tela mostrada quando não há rede

  (auth)/login            login
  (auth)/cadastro         cadastro (condição clínica é múltipla escolha)

  (aluno)/layout.tsx      Sidebar + BottomNav + barra "visão do aluno"
  (aluno)/home            saudação, check-in, indicadores, treino, humor
  (aluno)/treino          treino do dia, série a série, com portão pré-treino
  (aluno)/indicadores     registro + histórico + faixas de referência
  (aluno)/medicamentos    doses do dia num toque + cadastro
  (aluno)/humor           calendário e distribuição de 30 dias
  (aluno)/evolucao        gráficos (recharts) + avaliações físicas
  (aluno)/hidratacao      copo/garrafa/litro num toque + meta
  (aluno)/bem-estar       respiração guiada e aterramento 5-4-3-2-1
  (aluno)/conquistas      badges derivadas dos dados + streak
  (aluno)/desafios        lista, ranking e pontos do desafio (módulo 24)
  (aluno)/agenda          eventos com confirmação + comunicados
  (aluno)/anamnese        formulário de entrada de saúde
  (aluno)/perfil          dados, foto, contatos, notificações, relatório
  (aluno)/relatorio       folha mensal para o médico (imprime em PDF)
  (aluno)/familiares      convites de acompanhamento familiar
  (aluno)/acompanhar      visão restrita de quem é familiar de um aluno
  (auth)/familia          conta de familiar criada com o código do convite

  (professor)/layout.tsx  header + abas + botão "ver como aluno"
  (professor)/dashboard   números do dia, alertas realtime, alunos críticos
  (professor)/alunos      lista com busca e filtros por semáforo
  (professor)/alunos/[id] ficha completa do aluno
  (professor)/alunos/[id]/avaliacao   lançar avaliação física
  (professor)/treinos     lista / novo / editar, com upload de vídeo
  (professor)/agenda-professor        eventos e comunicados
  (professor)/presenca    quem está na academia, sumidos, movimento
  (professor)/desafios-professor      cria, convida e acompanha desafios

  chat/                   lista de conversas (fora dos dois grupos)
  chat/[id]               conversa com realtime

  api/push/inscrever      salva/apaga a assinatura de push do usuário
  api/cron/lembretes      medicamento, água e evento — roda a cada 15 min

components/aluno/    CardIndicador · CardTreino · RegistroHumor ·
                     FormularioIndicador · HistoricoIndicadores ·
                     ExecucaoTreino · PortaoPreTreino · DosesDoDia ·
                     GerenciarMedicamentos · GraficoIndicador ·
                     FormularioPerfil · FormularioAnamnese ·
                     BotaoCheckin · RegistroHidratacao · GuiaRespiracao ·
                     GuiaAterramento · ConfirmarPresenca ·
                     GerenciarFamiliares · AceitarConvite · BotaoImprimir
components/professor/ NavProfessor · CardAluno · ListaAlunos ·
                     AlertasRealtime · FormularioTreino ·
                     FormularioAvaliacao · GerenciarAgenda
components/shared/   BottomNav · Sidebar · AlternarVisao · BotaoSair ·
                     VideoExercicio · JanelaChat ·
                     GerenciarNotificacoes · RegistrarServiceWorker

lib/supabase/  client · server · servico (service role) · perfil ·
               home-aluno · indicadores · treino · medicamentos · humor ·
               evolucao · agenda · chat · presenca · hidratacao ·
               conquistas · familiares · relatorio · professor ·
               painel-professor
lib/utils/     index (cn) · semaforo · indicadores · saudacao · datas ·
               avatares · navegacao · erros-auth · video · bem-estar ·
               presenca (constantes de sumiço — client-safe de propósito)
lib/push/      servidor (envio via web-push, limpa assinatura morta)
```

**Regra de fuso:** nunca use `new Date()` direto para decidir "hoje" ou
"agora" — em produção o servidor roda em UTC. Use `lib/utils/datas.ts`.

**Regra da service role:** `lib/supabase/servico.ts` ignora RLS. Só pode ser
importado de rota de API ou server component — nunca de `"use client"`.

---

## BANCO DE DADOS (SUPABASE)

Tabelas principais:
- `profiles` — usuários (alunos e professores)
- `treinos` — treinos vinculados a aluno + professor
- `exercicios` — exercícios de cada treino com video_url
- `treino_execucoes` — histórico de execuções
- `medicamentos` — medicamentos cadastrados pelo aluno
- `medicamento_confirmacoes` — confirmações de tomada
- `indicadores` — glicemia, pressão, peso, FC, saturação
- `humor_diario` — estado do dia do aluno
- `eventos` — agenda da academia
- `mensagens` — chat professor-aluno
- `alertas_professor` — alertas em tempo real para o professor
- `avaliacoes_fisicas` — avaliações periódicas
- `notificacoes` — comunicados da academia
- `exercicio_execucoes` — cada série marcada pelo aluno (migração 004)
- `checkins` — presença na academia (004)
- `familiares_acesso` — convite e vínculo do familiar (004)
- `anamneses` — histórico de saúde de entrada (004)
- `hidratacao_registros` — copos de água (004)
- `aluno_conquistas` — quando cada badge caiu (004)

**Triggers automáticos**
- Indicador inserido: o banco calcula o semáforo e, se vermelho, cria alerta
  para o professor. O peso é a exceção — sai sempre verde, porque o critério
  real é o IMC e a altura mora em `avaliacoes_fisicas`.
- Humor `enfermo` ou `ansioso`: cria alerta para o professor (004).
- `professor_responsavel()` acha o professor pelo treino ativo e, se o aluno
  ainda não tem treino, cai no professor mais antigo do centro.

**Funções de RLS** (004, todas `security definer` com `search_path` fixo)
- `eh_professor(uid)` — usada pelas policies que dão visão de professor.
  Precisa ser função porque uma policy em `profiles` que consulta `profiles`
  entra em recursão infinita.
- `eh_meu_familiar(dono)` — libera indicadores e check-ins para o familiar.

**Storage**: buckets públicos `avatares`, `exercicios` e `medicamentos`. O
primeiro nível do caminho é o id do dono (`avatares/<uid>/foto.jpg`) — é o
que a policy usa para saber quem pode escrever onde.

---

## REGRAS IMPORTANTES DE DESENVOLVIMENTO

### Segurança
- Nunca expor SUPABASE_SERVICE_ROLE_KEY no frontend
- Usar sempre RLS (Row Level Security) — já configurado no schema
- Aluno só vê seus próprios dados
- Professor vê dados dos seus alunos

### UX
**Linguagem visual completa em `docs/DESIGN.md` — leia antes de mexer em tela.**
- **Mobile-first** — a maioria dos alunos vai usar no celular
- Marca Atitude Vital: fundo névoa `#F3F6F6`, cards brancos com contorno de 1px, grafite `#0F1618` como único destaque escuro, ciano `#00B4CB` na marca e `#0A8FA3` em botão/link (`primary`). Nada de azul.
- Semáforo: verde `#16A34A`, amarelo `#D97706`, vermelho `#DC2626` — mostrado com chip e com a faixa `FaixaSemaforo`
- Fontes: Sora em títulos e números (utilidade `numero`), Inter no texto, Geist Mono em rótulos e horários (utilidade `rotulo`)
- Um destaque por tela; sem ícone em quadradinho colorido; telas internas usam `CabecalhoPagina`
- Logo e ícones saem de `public/Logo.jpg` via `node scripts/gerar_marca.mjs`
- Para avatar 60+ e cardiopata: fontes maiores, botões grandes, menos elementos por tela

### Componentes
- Usar shadcn/ui para componentes base
- Ícones: lucide-react
- Gráficos: recharts
- Datas: date-fns com locale ptBR

### Dados em tempo real
- Usar Supabase Realtime para alertas do professor
- Canal: `alertas_professor` filtrado pelo professor_id

---

## AVATARES / CONDIÇÕES CLÍNICAS

```typescript
type AvatarCondicao =
  | 'diabetico'
  | 'hipertenso'
  | '60+'
  | 'colesterol'
  | 'menopausa'
  | 'performance'
  | 'adolescente'
  | 'gestante'
  | 'cardiopata'
  | 'obesidade'
```

---

## SEMÁFORO — FAIXAS CLÍNICAS

| Indicador  | 🟢 Verde       | 🟡 Amarelo      | 🔴 Vermelho        |
|------------|---------------|-----------------|-------------------|
| Pressão    | < 130/85      | 130–160/85–100  | > 160/100          |
| Glicemia   | 70–125 mg/dL  | 126–199 mg/dL   | > 200 ou < 70      |
| Saturação  | ≥ 95%         | 90–94%          | < 90%              |
| FC         | 50–90 bpm     | 91–100 bpm      | > 100 ou < 50      |
| IMC        | < 25          | 25–29,9         | ≥ 30               |

**Se vermelho**: criar registro em `alertas_professor` + notificar professor em tempo real.

---

## MÓDULOS — STATUS DE DESENVOLVIMENTO

Legenda: `[x]` pronto · `[~]` parcial · `[ ]` não começou

**Base**
- [x] Auth (login/cadastro, condição clínica múltipla)
- [x] Home do aluno com saudação, check-in e dados reais
- [x] Alternar visão professor ↔ aluno
- [x] PWA — manifest, service worker, ícones, tela offline

**1. Treino** — [x] aluno marca cada série e registra esforço de 1 a 10 ·
[x] professor cria/edita treinos com upload de vídeo (YouTube, Vimeo ou
arquivo no storage)

**2. Indicadores** — [x] registro com semáforo · [x] alerta ao professor pelo
gatilho do banco · [x] realtime no painel

**3. Medicamentos** — [x] cadastro com horários e dias · [x] confirmação num
toque · [x] push de dose atrasada · [x] o professor vê as pendências no card
do aluno

**4. Humor** — [x] registro na home · [x] calendário e distribuição de 30 dias

**5. Evolução** — [x] gráficos de linha por indicador · [x] variação contra o
período anterior · [x] treinos por mês

**6. Agenda** — [x] professor cria eventos e comunicados · [x] aluno confirma
presença · [x] push uma hora antes

**7. Chat** — [x] conversa direta com realtime, fora dos grupos de rota

**8. Bem-estar** — [x] três ritmos de respiração guiada · [x] aterramento
5-4-3-2-1 · [~] biblioteca de áudio pronta, faltam as gravações dos sócios

**9. Perfil** — [x] foto, dados, condições, contatos, notificações

**10. Painel do professor** — [x] números do dia · [x] alertas em tempo real
· [x] lista com busca e filtros · [x] ficha completa do aluno

**11. Avaliação física** — [x] lançamento pelo professor com IMC ao vivo ·
[x] comparativo na evolução do aluno

**12. Check-in** — [x] entrada e saída num toque · [x] painel de presentes ·
[x] lista de sumidos há 5+ dias · [x] movimento de 30 dias

**13. Alerta pré-treino** — [x] o portão pede o indicador da condição do
aluno antes de liberar o treino; no vermelho, avisa e pede confirmação

**14. Relatório para o médico** — [x] folha mensal com CSS de impressão; o
PDF sai pelo próprio navegador, sem biblioteca

**15. Acompanhamento familiar** — [x] convite por código · [x] visão restrita
a indicadores e frequência · [x] RLS própria · [x] quem recebe o convite cria
uma conta de familiar em `/familia?codigo=` (sem convite do professor; o
e-mail precisa ser o do convite) e fica preso em `/acompanhar` pelo middleware

**16. Conquistas** — [x] nove badges derivadas dos dados · [x] streak de
presença · [x] marca as novas como vistas

**17. Anamnese** — [x] formulário do aluno · [x] o professor lê na ficha ·
[x] professor edita, reordena, arquiva e cria perguntas (`/alunos/anamnese`)
em oito tipos: texto curto e longo, escolha única e múltipla, sim ou não,
número, escala 0 a 10 e data · [~] depende da migração 011

**18. Hidratação** — [x] registro num toque com meta e histórico · [x] push
ao longo do dia

**19. Exames** — [x] upload de PDF/imagem com tipo e data (`/exames`) ·
[x] link público com prazo para o médico (`/exames/compartilhado/[token]`),
que mostra também medições de 90 dias, medicamentos e a anamnese marcada
"vai ao médico"

**20. Convite de aluno** — [x] professor convida por nome e e-mail
(`/alunos/convidar`) · [x] primeira senha em `/definir-senha` · [~] template
de e-mail a configurar no Supabase

**21. Tour guiado** — [x] abre na primeira visita à home (`TourGuiado`,
marca `av-tour-visto-v1` no user_metadata) · `?tour=1` reabre

**22. Sininho** — [x] central de notificações do aluno e do professor com
realtime (`SinoNotificacoes`)

**24. Desafios** — [x] o professor cria com período, regras e convidados
(`/desafios-professor`) · [x] o aluno entra, vê ranking e de onde vieram os
pontos (`/desafios`) · pontuação automática pelo que já existe (presença,
treino, indicador, água, medicamento, humor), um ponto por hábito por dia ·
ranking mostra só "Maria S." e pontos, por função `security definer`

**23. Check-in e treino com energia** — [x] comemoração com confete e
sequência · [x] cronômetro e duração do treino para o professor ·
[~] duração exata depende da migração 008

---

## O QUE AINDA FALTA

1. **Gravar os áudios de bem-estar** e colar as URLs em
   `lib/utils/bem-estar.ts` (`AUDIOS`). O player já está pronto e a tela
   trata a lista vazia; é o único vazio de conteúdo que sobrou.
2. **Push e cron nunca rodaram de verdade** — `/api/cron/lembretes` e o envio
   web-push só foram lidos, não exercitados. Precisam de um device real com
   permissão de notificação concedida.
3. **Migrações a aplicar no SQL Editor** (DDL não roda pela service role; com
   `SUPABASE_ACCESS_TOKEN` no ambiente dá para rodar pela Management API, mas
   precisa de permissão liberada no Claude Code):
   - 005 trava o papel (gatilho lê `role` de `raw_app_meta_data`; professor
     novo só por `supabase/scripts/criar_professor.sql`) e 006 põe cascata nas
     chaves para `profiles`/`auth.users` — conferir se já estão no banco.
   - 007 exames: tabelas `exames` e `exames_compartilhamentos` + bucket
     privado `exames`. Sem ela a tela /exames mostra "sendo ativado".
   - 008 duração do treino: `iniciado_em`, `concluido_em`, `duracao_segundos`
     em `treino_execucoes`. Antes dela o tempo é estimado pelas séries.
   - 009 põe `notificacoes` no Realtime (comunicado chega na hora no sino).
   - 010 texto do alerta de indicador crítico sem travessão.
   - 011 e 012 já aplicadas (17/09/2026). 012 cria o papel `familiar`; o Auth
     grava o app_metadata depois do insert, então `/api/familia/cadastro`
     acerta `profiles.role` pela service role logo depois de criar a conta.
   - 013 desafios: tabelas `desafios` e `desafio_participantes` + funções
     `ranking_desafio`, `detalhe_pontos_desafio` e `resumo_desafios`.
   - 011 anamnese editável: tabela `anamnese_perguntas` + `anamneses.respostas`
     (jsonb por id da pergunta). Sem ela o formulário usa `PERGUNTAS_PADRAO`
     de `lib/utils/anamnese.ts` e o editor fica só leitura. As colunas antigas
     de `anamneses` continuam sendo gravadas pelas perguntas originais
     (`coluna_legada`).
4. **Convite por e-mail** — feito em 17/09/2026: `bash scripts/aplicar_emails.sh`
   manda os modelos de `docs/emails/*.html` (marca Atitude Vital), os assuntos
   em português, a Site URL de produção e as Redirect URLs. Falta só desligar
   "Allow new users to sign up" no painel do Supabase (o cadastro público saiu;
   /cadastro redireciona ao login) e, para convidar a turma inteira sem o
   limite do SMTP do Supabase, configurar um SMTP próprio (o projeto financeiro
   usa Resend com remetente da marca).

**Já resolvido:** projeto na Vercel (time Pro) com as sete variáveis nos três
ambientes; "esqueci a senha" (`/esqueci-senha` → e-mail →
`/auth/confirmar` → `/redefinir-senha`). Para os links de e-mail funcionarem,
o domínio da Vercel precisa estar em Authentication → URL Configuration.

---

## DADOS DE TESTE

`node supabase/scripts/popular_dados_teste.mjs` povoa o banco com uma academia
inteira: uma professora, oito alunos de condições diferentes e dois meses de
história. Roda quantas vezes quiser — apaga o que semeou antes e o sorteio tem
semente fixa, então o resultado é sempre o mesmo.

Todo mundo entra com a senha `teste1234`:

| Conta | Quem é |
|---|---|
| `professora@teste.local` | Rita Salgado — dona dos treinos, e por isso dos alertas |
| `ana@teste.local` | diabética e obesa — **sumida há 9 dias** |
| `joao@teste.local` | hipertenso, cardiopata, 60+ — **pico de 168/104** |
| `marlene@teste.local` | 60+, menopausa, colesterol — presença perfeita |
| `pedro@teste.local` | performance |
| `beatriz@teste.local` | gestante |
| `sergio@teste.local` | colesterol e hipertenso — frequência irregular |
| `lucas@teste.local` | adolescente |
| `rosa@teste.local` | diabética, hipertensa, 60+ — **glicemia 211** |

Os três em negrito existem para exercitar caminho de exceção: lista de sumidos,
alerta em tempo real com o portão pré-treino barrando, e semáforo vermelho.

O semáforo e os alertas **não** são semeados — quem os cria é o gatilho do
banco ao receber os indicadores. Se a distribuição sair diferente de ~400
verde / 60 amarelo / 2 vermelho, o gatilho é que mudou.

Alerta tem dono: a policy é `auth.uid() = professor_id` e
`professor_responsavel()` acha o professor pelo treino ativo do aluno. Por isso
o seed pendura os treinos na Rita — entrando com outra conta de professor você
vê os alunos (a lista é da casa inteira) mas não os alertas.

---

## COMO PEDIR AJUDA AO CLAUDE

Seja específico sobre o módulo e o que precisa:

**Exemplos de prompts eficientes:**
- "Crie a tela /app/(aluno)/indicadores/page.tsx seguindo o padrão do projeto. O aluno deve conseguir registrar glicemia, pressão e peso. Após salvar, mostrar o semáforo com a cor correta. Se vermelho, criar alerta na tabela alertas_professor."
- "Crie o componente CardAluno em /components/professor/CardAluno.tsx. Deve mostrar foto, nome, condição clínica, se treinou hoje, humor do dia e último indicador com semáforo."
- "Adicione notificações push no módulo de medicamentos. Quando o horário do medicamento chegar e o aluno não confirmar em 15 minutos, enviar reforço."
