# Notificações

Todo aviso do app nasce como uma linha em `notificacoes_usuario` (migração
018) e diz por onde sai: **sino** (sininho do app), **push** (celular) e
**e-mail** (Resend, com a marca). A entrega é de `/api/notificacoes/despachar`,
chamada pelo banco na hora (pg_net) e varrida pelo cron a cada 15 minutos.

Os e-mails de conta (convite, esqueci a senha) continuam saindo pelo Supabase
Auth com os modelos de `docs/emails/`, pelo SMTP do Resend.

## Aluno

| Evento | Sino | Push | E-mail | Onde nasce |
|---|:-:|:-:|:-:|---|
| Convite do professor | | | ✓ | Supabase Auth (`invite`) |
| Esqueci a senha | | | ✓ | Supabase Auth (`recovery`) |
| Dose vencida sem confirmação | ✓ | ✓ | | cron (lembrete) |
| Hora de beber água | | ✓ | | cron (10h, 14h, 17h) |
| Evento ou aula em uma hora | ✓ | ✓ | | cron |
| Aula cancelada | ✓ | ✓ | ✓ | gatilho `aula_cancelamentos` |
| Comunicado | ✓ | ✓ | se importante | gatilho `notificacoes` |
| Evento novo na agenda | ✓ | ✓ | | gatilho `eventos` |
| Mensagem do professor | ✓ | ✓ | | gatilho `mensagens` |
| Treino novo ou alterado | ✓ | ✓ | | gatilho `treinos` / `exercicios` (um por dia) |
| Avaliação física lançada | ✓ | ✓ | | gatilho `avaliacoes_fisicas` |
| Convite para desafio | ✓ | ✓ | | gatilho `desafio_participantes` |
| Familiar aceitou o convite | ✓ | ✓ | | gatilho `familiares_acesso` |
| Link de exames aberto | ✓ | ✓ | | página `/exames/compartilhado` (um por dia) |
| Conquista nova (badge) | ✓ | ✓ | ✓ | cron, 9h |
| Marco de presença (10, 25, 50, 100, 200, 365) | ✓ | ✓ | ✓ | cron, 9h |
| Marco de treinos (1, 10, 25, 50, 100, 200) | ✓ | ✓ | ✓ | cron, 9h |
| Sequência de dias (5, 10, 20, 30) | ✓ | ✓ | ✓ | cron, 9h |
| Resumo do mês | | | ✓ | cron, dia 1 às 9h |

Nos marcos só o maior alcançado é comemorado, então ninguém recebe quatro
e-mails de uma vez. A sequência pode ser comemorada de novo quando recomeça.

## Professor e admin

| Evento | Sino | Push | E-mail | Onde nasce |
|---|:-:|:-:|:-:|---|
| Convite para a equipe | | | ✓ | Supabase Auth (`invite`) |
| Indicador crítico | ✓ | ✓ | ✓ | gatilho do semáforo → `alertas_professor` |
| Aluno treinou depois do vermelho | ✓ | ✓ | ✓ | portão pré-treino → `avisar_treino_no_vermelho()` |
| Humor enfermo ou ansioso | ✓ | ✓ | | gatilho `humor_diario` |
| 2 ou mais doses esquecidas ontem | ✓ | ✓ | | cron, 8h |
| Aluno sumido há 5 dias ou mais | ✓ | ✓ | | cron, 8h (não repete por 7 dias) |
| Mensagem de aluno | ✓ | ✓ | | gatilho `mensagens` |
| Anamnese preenchida ou atualizada | ✓ | ✓ | | gatilho `anamneses` |
| Exame enviado | ✓ | | | gatilho `exames` |
| Aluno convidado fez o primeiro acesso | ✓ | | | gatilho em `auth.users` |
| Professor novo fez o primeiro acesso (para os admins) | ✓ | | | gatilho em `auth.users` |
| Resumo da semana: sumidos e críticos | | | ✓ | cron, segunda às 8h |

O professor liga o push no fim do painel (`/dashboard`).

## Familiar

| Evento | E-mail | Onde nasce |
|---|:-:|---|
| Convite com o link de acesso | ✓ | gatilho `familiares_acesso` |
| Indicador crítico do aluno | ✓ | gatilho do alerta, **só se o aluno ligou** em `/familiares` |

## Regras

- Endereço `@teste.local` (dados de teste) nunca recebe e-mail.
- Push é melhor esforço; e-mail recusado tenta de novo até 3 vezes.
- A `chave` de cada aviso impede repetição quando o cron passa várias vezes na
  mesma hora.
- Um erro ao avisar nunca impede a escrita original (o gatilho só registra um
  warning no log do banco).
