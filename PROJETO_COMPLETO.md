# CENTRAL DE SAÚDE CONECTADA
## Guia Completo de Desenvolvimento — VS Code + Supabase + Vercel

---

## STACK TÉCNICA

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage + Realtime)
- **Deploy**: Vercel
- **Notificações Push**: Web Push API (PWA)
- **Upload de vídeo**: Supabase Storage
- **IA (Fase 2)**: OpenAI API

---

## ESTRUTURA DE PASTAS

saude-conectada/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── cadastro/page.tsx
│   ├── (aluno)/
│   │   ├── layout.tsx
│   │   ├── home/page.tsx                  ← tela de entrada com saudação
│   │   ├── treino/page.tsx
│   │   ├── treino/[id]/page.tsx
│   │   ├── indicadores/page.tsx
│   │   ├── remedios/page.tsx
│   │   ├── humor/page.tsx
│   │   ├── evolucao/page.tsx
│   │   └── agenda/page.tsx
│   ├── (professor)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx             ← painel geral dos alunos
│   │   ├── alunos/page.tsx
│   │   ├── alunos/[id]/page.tsx
│   │   ├── treinos/page.tsx               ← criar/editar treinos
│   │   ├── agenda/page.tsx
│   │   └── notificacoes/page.tsx
│   └── api/
│       ├── push/route.ts
│       └── alerts/route.ts
├── components/
│   ├── ui/                                ← shadcn components
│   ├── aluno/
│   │   ├── SaudacaoPersonalizada.tsx
│   │   ├── MenuPrincipal.tsx
│   │   ├── CardIndicador.tsx
│   │   ├── Semaforo.tsx
│   │   ├── GraficoEvolucao.tsx
│   │   └── CardTreino.tsx
│   ├── professor/
│   │   ├── PainelAlunos.tsx
│   │   ├── AlertasUrgentes.tsx
│   │   └── CardAluno.tsx
│   └── shared/
│       ├── BottomNav.tsx
│       └── Header.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── utils/
│   │   ├── semaforo.ts                    ← lógica das faixas clínicas
│   │   ├── saudacao.ts                    ← lógica da saudação personalizada
│   │   └── notificacoes.ts
│   └── types/
│       └── index.ts
├── public/
│   ├── manifest.json                      ← PWA
│   └── sw.js                              ← Service Worker
└── supabase/
    └── migrations/
        └── 001_schema_inicial.sql

---

## SCHEMA DO BANCO DE DADOS (SUPABASE)

Cole esse SQL no SQL Editor do Supabase:

```sql
-- ============================================
-- SCHEMA CENTRAL DE SAÚDE CONECTADA
-- ============================================

-- PERFIS DOS USUÁRIOS
create table profiles (
  id uuid references auth.users primary key,
  nome text not null,
  email text not null,
  telefone text,
  foto_url text,
  data_nascimento date,
  role text not null default 'aluno', -- 'aluno' | 'professor'
  avatar_condicao text, -- 'diabetico' | 'hipertenso' | '60+' etc
  observacoes_clinicas text, -- visível só para professor
  familiar_nome text,
  familiar_telefone text,
  medico_nome text,
  medico_telefone text,
  created_at timestamptz default now()
);

-- TREINOS
create table treinos (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id),
  aluno_id uuid references profiles(id),
  nome text not null,
  descricao text,
  dia_semana text[], -- ['segunda', 'quarta', 'sexta']
  ativo boolean default true,
  created_at timestamptz default now()
);

-- EXERCÍCIOS DO TREINO
create table exercicios (
  id uuid primary key default gen_random_uuid(),
  treino_id uuid references treinos(id) on delete cascade,
  nome text not null,
  series int,
  repeticoes text, -- '12-15' ou '30 segundos'
  carga text,
  descanso text,
  video_url text,
  ordem int,
  observacoes text
);

-- EXECUÇÃO DE TREINOS (histórico)
create table treino_execucoes (
  id uuid primary key default gen_random_uuid(),
  treino_id uuid references treinos(id),
  aluno_id uuid references profiles(id),
  data date default current_date,
  concluido boolean default false,
  esforco_percebido int, -- 1 a 10
  observacao text,
  created_at timestamptz default now()
);

-- MEDICAMENTOS
create table medicamentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id),
  nome text not null,
  dose text,
  horarios text[], -- ['08:00', '20:00']
  dias_semana text[], -- ['segunda','terca'...] ou null = todo dia
  condicao text,
  foto_url text,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- CONFIRMAÇÃO DE MEDICAMENTOS
create table medicamento_confirmacoes (
  id uuid primary key default gen_random_uuid(),
  medicamento_id uuid references medicamentos(id),
  aluno_id uuid references profiles(id),
  data_hora timestamptz default now(),
  status text not null, -- 'tomou' | 'nao_tomou' | 'adiou'
  motivo text
);

-- INDICADORES DE SAÚDE
create table indicadores (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id),
  tipo text not null, -- 'glicemia' | 'pressao' | 'peso' | 'fc' | 'saturacao'
  valor_principal numeric,
  valor_secundario numeric, -- para pressão: diastólica
  unidade text,
  momento text, -- 'jejum' | 'pos_refeicao' | 'pre_treino' | 'pos_treino'
  status_semaforo text, -- calculado: 'verde' | 'amarelo' | 'vermelho'
  alerta_enviado boolean default false,
  observacao text,
  created_at timestamptz default now()
);

-- HUMOR E ESTADO DO DIA
create table humor_diario (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id),
  data date default current_date,
  humor text not null, -- 'otimo' | 'disposto' | 'cansado' | 'dormiu_mal' | 'enfermo' | 'ansioso'
  qualidade_sono int, -- 1 a 5
  observacao text,
  created_at timestamptz default now(),
  unique(aluno_id, data) -- um registro por dia
);

-- AGENDA / EVENTOS
create table eventos (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id),
  titulo text not null,
  descricao text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  para_todos boolean default true,
  avatar_condicao text[], -- null = todos, ou ['diabetico', 'hipertenso']
  created_at timestamptz default now()
);

-- CONFIRMAÇÃO DE EVENTOS POR ALUNO
create table evento_confirmacoes (
  evento_id uuid references eventos(id),
  aluno_id uuid references profiles(id),
  confirmado boolean default false,
  primary key (evento_id, aluno_id)
);

-- MENSAGENS (CHAT)
create table mensagens (
  id uuid primary key default gen_random_uuid(),
  de uuid references profiles(id),
  para uuid references profiles(id),
  texto text,
  audio_url text,
  lida boolean default false,
  created_at timestamptz default now()
);

-- NOTIFICAÇÕES DA ACADEMIA
create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id),
  titulo text not null,
  corpo text not null,
  para_todos boolean default true,
  avatar_condicao text[],
  created_at timestamptz default now()
);

-- AVALIAÇÃO FÍSICA
create table avaliacoes_fisicas (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid references profiles(id),
  professor_id uuid references profiles(id),
  data date default current_date,
  peso numeric,
  altura numeric,
  imc numeric generated always as (peso / ((altura/100) * (altura/100))) stored,
  percentual_gordura numeric,
  massa_muscular numeric,
  circunferencia_cintura numeric,
  circunferencia_quadril numeric,
  teste_forca text,
  observacoes text,
  created_at timestamptz default now()
);

-- ALERTAS DO PROFESSOR (tempo real)
create table alertas_professor (
  id uuid primary key default gen_random_uuid(),
  professor_id uuid references profiles(id),
  aluno_id uuid references profiles(id),
  tipo text not null, -- 'indicador_vermelho' | 'remedio_nao_tomado' | 'humor_ruim' | 'sem_treinar'
  mensagem text not null,
  dados jsonb, -- dados do aluno que gerou o alerta
  resolvido boolean default false,
  created_at timestamptz default now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table profiles enable row level security;
alter table treinos enable row level security;
alter table exercicios enable row level security;
alter table treino_execucoes enable row level security;
alter table medicamentos enable row level security;
alter table medicamento_confirmacoes enable row level security;
alter table indicadores enable row level security;
alter table humor_diario enable row level security;
alter table eventos enable row level security;
alter table mensagens enable row level security;
alter table notificacoes enable row level security;
alter table avaliacoes_fisicas enable row level security;
alter table alertas_professor enable row level security;

-- Aluno vê só os próprios dados
create policy "aluno_proprio_perfil" on profiles
  for all using (auth.uid() = id);

create policy "aluno_proprios_treinos" on treinos
  for select using (auth.uid() = aluno_id);

create policy "aluno_proprios_indicadores" on indicadores
  for all using (auth.uid() = aluno_id);

create policy "aluno_proprio_humor" on humor_diario
  for all using (auth.uid() = aluno_id);

create policy "aluno_proprios_medicamentos" on medicamentos
  for all using (auth.uid() = aluno_id);

-- Professor vê tudo dos seus alunos
create policy "professor_ve_alunos" on profiles
  for select using (
    exists (
      select 1 from treinos
      where professor_id = auth.uid()
      and aluno_id = profiles.id
    )
    or auth.uid() = id
  );

create policy "professor_gerencia_treinos" on treinos
  for all using (auth.uid() = professor_id);

create policy "professor_ve_indicadores" on indicadores
  for select using (
    exists (
      select 1 from treinos
      where professor_id = auth.uid()
      and aluno_id = indicadores.aluno_id
    )
  );

-- ============================================
-- FAIXAS CLÍNICAS (função para calcular semáforo)
-- ============================================

create or replace function calcular_semaforo(
  p_tipo text,
  p_valor_principal numeric,
  p_valor_secundario numeric default null
) returns text as $$
begin
  case p_tipo
    when 'pressao' then
      if p_valor_principal >= 160 or p_valor_secundario >= 100 then
        return 'vermelho';
      elsif p_valor_principal >= 130 or p_valor_secundario >= 85 then
        return 'amarelo';
      else
        return 'verde';
      end if;
    when 'glicemia' then
      if p_valor_principal >= 200 or p_valor_principal < 70 then
        return 'vermelho';
      elsif p_valor_principal >= 126 then
        return 'amarelo';
      else
        return 'verde';
      end if;
    when 'peso' then
      -- IMC calculado fora, aqui recebe o IMC
      if p_valor_principal >= 30 then
        return 'vermelho';
      elsif p_valor_principal >= 25 then
        return 'amarelo';
      else
        return 'verde';
      end if;
    when 'saturacao' then
      if p_valor_principal < 90 then
        return 'vermelho';
      elsif p_valor_principal < 94 then
        return 'amarelo';
      else
        return 'verde';
      end if;
    when 'fc' then
      if p_valor_principal > 100 or p_valor_principal < 50 then
        return 'vermelho';
      elsif p_valor_principal > 90 then
        return 'amarelo';
      else
        return 'verde';
      end if;
    else
      return 'verde';
  end case;
end;
$$ language plpgsql;

-- Trigger para calcular semáforo automaticamente e gerar alerta
create or replace function trigger_indicador_alerta()
returns trigger as $$
declare
  v_semaforo text;
  v_professor_id uuid;
begin
  -- Calcular semáforo
  v_semaforo := calcular_semaforo(new.tipo, new.valor_principal, new.valor_secundario);
  new.status_semaforo := v_semaforo;

  -- Se vermelho, criar alerta para o professor
  if v_semaforo = 'vermelho' then
    select professor_id into v_professor_id
    from treinos
    where aluno_id = new.aluno_id
    and ativo = true
    limit 1;

    if v_professor_id is not null then
      insert into alertas_professor (professor_id, aluno_id, tipo, mensagem, dados)
      values (
        v_professor_id,
        new.aluno_id,
        'indicador_vermelho',
        'Indicador em nível crítico registrado antes do treino',
        jsonb_build_object(
          'tipo', new.tipo,
          'valor', new.valor_principal,
          'valor2', new.valor_secundario,
          'momento', new.momento
        )
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger on_indicador_insert
  before insert on indicadores
  for each row execute function trigger_indicador_alerta();
```

---

## VARIÁVEIS DE AMBIENTE (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
NEXT_PUBLIC_APP_URL=http://localhost:3000
VAPID_PUBLIC_KEY=gerar_com_web-push
VAPID_PRIVATE_KEY=gerar_com_web-push
```

---

## COMANDOS PARA COMEÇAR

```bash
# 1. Criar o projeto
npx create-next-app@latest saude-conectada \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"

cd saude-conectada

# 2. Instalar dependências
npm install @supabase/supabase-js @supabase/ssr
npm install @supabase/auth-ui-react @supabase/auth-ui-shared
npm install recharts                    # gráficos de evolução
npm install date-fns                    # formatação de datas
npm install web-push                    # notificações push
npm install lucide-react               # ícones
npm install next-pwa                   # PWA

# 3. Instalar shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card input label toast badge avatar

# 4. Instalar Supabase CLI (para migrations)
npm install supabase --save-dev
npx supabase init
```

---

## ORDEM DE DESENVOLVIMENTO

### SEMANA 1 — Base e Auth
1. Setup do projeto (comandos acima)
2. Configurar Supabase — criar projeto, rodar SQL do schema
3. Sistema de login e cadastro
4. Perfil do aluno e do professor
5. Deploy inicial na Vercel

### SEMANA 2 — Tela Home e Indicadores
1. Tela de entrada com saudação personalizada
2. Menu principal com ações rápidas
3. Registro de indicadores (glicemia, pressão, peso)
4. Semáforo visual
5. Alerta em tempo real para o professor

### SEMANA 3 — Treinos
1. Painel do professor para criar treinos
2. Upload de vídeos no Supabase Storage
3. Tela do aluno com treino do dia
4. Player de vídeo por exercício
5. Marcação de conclusão

### SEMANA 4 — Medicamentos e Humor
1. Cadastro de medicamentos
2. Notificações push (Web Push PWA)
3. Confirmação de tomada
4. Humor e estado do dia
5. Alerta para professor quando não confirmado

### SEMANA 5 — Dashboard e Agenda
1. Gráficos de evolução (recharts)
2. Agenda com eventos
3. Chat professor-aluno
4. Notificações da academia
5. Avaliação física

### SEMANA 6 — Refinamento e Launch
1. PWA completo (manifest + service worker)
2. Testes com os 32 alunos reais
3. Ajustes de UX
4. Monitoramento de erros
5. Launch oficial

---

## PROMPTS PRONTOS PARA O CLAUDE NO VS CODE

Cole esses prompts diretamente no Claude do VS Code na ordem abaixo:

### PROMPT 1 — Setup e Auth
```
Crie o sistema de autenticação completo para um PWA de saúde chamado "Central de Saúde Conectada".

Stack: Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase Auth.

O sistema tem dois tipos de usuário: 'aluno' e 'professor'.

Crie:
1. /app/(auth)/login/page.tsx — tela de login com email/senha e Google OAuth
2. /app/(auth)/cadastro/page.tsx — cadastro com nome, email, senha, telefone e seleção de avatar/condição clínica (diabético, hipertenso, 60+, colesterol, menopausa, performance, adolescente, gestante, cardiopata)
3. /lib/supabase/client.ts — cliente Supabase para browser
4. /lib/supabase/server.ts — cliente Supabase para server components
5. /middleware.ts — proteção de rotas, redireciona aluno para /home e professor para /dashboard

Design: clean, cores azul médico (#2563EB) e verde saúde (#16A34A), mobile-first, fonte Inter.
```

### PROMPT 2 — Tela Home com Saudação
```
Crie a tela principal do aluno em /app/(aluno)/home/page.tsx.

Ela deve:
1. Buscar os dados do aluno autenticado no Supabase (profile, último indicador registrado, treino de hoje, remédio pendente)
2. Mostrar saudação personalizada baseada em:
   - Hora do dia (bom dia/tarde/noite)
   - Último indicador registrado ("sua pressão ontem estava ótima 🟢")
   - Frequência de treino da semana
   - Se tem remédio pendente hoje
3. Menu principal com cards grandes e ícones:
   - 🏋️ Meu treino de hoje
   - 📊 Meus indicadores
   - 💊 Meus remédios
   - 😊 Como estou hoje
   - 📅 Agenda
4. Card de alerta no topo se houver algo pendente (remédio não confirmado, indicador em vermelho)

Use os dados reais do Supabase. Crie o arquivo /lib/utils/saudacao.ts com a lógica de geração da saudação.

Design mobile-first, fundo branco, cards com sombra suave, ícones lucide-react.
```

### PROMPT 3 — Indicadores e Semáforo
```
Crie o módulo de indicadores de saúde em /app/(aluno)/indicadores/page.tsx.

Funcionalidades:
1. Formulário de registro de indicador com:
   - Tipo: glicemia, pressão arterial, peso, FC, saturação
   - Para pressão: dois campos (sistólica e diastólica)
   - Momento: jejum, pós-refeição, pré-treino, pós-treino
   - Observação opcional
2. Após salvar, mostrar semáforo visual imediatamente:
   - 🟢 Verde: dentro da faixa ideal
   - 🟡 Amarelo: atenção
   - 🔴 Vermelho: cuidado — exibe mensagem "Seu professor foi notificado"
3. Lista dos últimos registros com semáforo em cada um
4. Crie /lib/utils/semaforo.ts com as faixas clínicas:
   - Pressão: verde <130/85, amarelo 130-160/85-100, vermelho >160/100
   - Glicemia: verde 70-125, amarelo 126-199, vermelho >200 ou <70
   - Saturação: verde >94, amarelo 90-94, vermelho <90
5. Ao salvar indicador vermelho, inserir registro em alertas_professor no Supabase

Use Supabase para salvar. Realtime para o professor receber o alerta instantaneamente.
```

### PROMPT 4 — Treinos (Professor)
```
Crie o módulo de criação de treinos para o professor em /app/(professor)/treinos/page.tsx.

Funcionalidades:
1. Lista de alunos do professor com botão "Criar/Editar treino"
2. Formulário de criação de treino:
   - Nome do treino (ex: "Treino A — Força")
   - Seleção de dias da semana
   - Adicionar exercícios com:
     - Nome do exercício
     - Séries e repetições
     - Carga
     - Descanso
     - Upload de vídeo demonstrativo (Supabase Storage, bucket 'videos-treino')
     - Observações
   - Reordenar exercícios por drag (ou botões cima/baixo)
3. Preview do treino como o aluno vai ver
4. Salvar treino vinculado ao aluno

Crie também /app/(aluno)/treino/page.tsx:
1. Mostrar o treino de hoje baseado no dia da semana
2. Cada exercício em card com: nome, séries/reps, carga, botão play do vídeo
3. Player de vídeo inline ao clicar
4. Checkbox para marcar cada série concluída
5. Ao concluir todos: tela de parabéns + campo de esforço percebido (1-10) + observação
6. Salvar execução no Supabase

Use Supabase Storage para vídeos. Limite de upload: 100MB por vídeo.
```

### PROMPT 5 — Medicamentos
```
Crie o módulo de medicamentos completo.

/app/(aluno)/remedios/page.tsx:
1. Lista de medicamentos cadastrados com status de hoje (tomou/pendente)
2. Formulário de cadastro:
   - Nome, dose, horários (múltiplos), dias da semana, condição, foto (opcional)
3. Botão de confirmação rápida em cada medicamento pendente
4. Histórico de adesão do mês em calendário visual (verde=tomou, vermelho=não tomou, cinza=sem registro)
5. Percentual de adesão do mês

Lógica de notificações em /lib/utils/notificacoes.ts:
1. Web Push notifications para os horários cadastrados
2. Mensagem com contexto: se tem treino hoje, incluir aviso de glicemia/FC
3. Reforço após 15 min sem confirmação
4. Após 30 min: alerta para familiar (se configurado)

/app/(professor)/dashboard/page.tsx — adicionar seção:
- Alunos que não confirmaram remédio hoje e têm treino
- Alerta visual destacado para cardiopatas e diabéticos

Use Supabase para persistência. Web Push API para notificações PWA.
```

### PROMPT 6 — Dashboard de Evolução
```
Crie o dashboard de evolução em /app/(aluno)/evolucao/page.tsx.

Gráficos usando Recharts:
1. Gráfico de linha — peso ao longo do tempo (últimos 30/60/90 dias, toggle)
2. Gráfico de linha — glicemia ao longo do tempo
3. Gráfico de linha — pressão arterial (duas linhas: sistólica e diastólica)
4. Cards de resumo do mês:
   - Total de treinos realizados / planejados
   - Percentual de adesão a medicamentos
   - Humor médio do mês (emoji representativo)
   - Melhor indicador do mês
5. Linha do tempo de conquistas:
   - "Há 3 meses sua glicemia estava em 180, hoje está em 115"
   - Calculado automaticamente comparando primeiro e último registro
6. Botão "Gerar relatório PDF" — gera PDF simples com os dados para levar ao médico

Design: clean, cores do semáforo nos gráficos, mobile-first.
Dados reais do Supabase. Filtros por período.
```

### PROMPT 7 — Painel do Professor (Tempo Real)
```
Crie o painel principal do professor em /app/(professor)/dashboard/page.tsx.

Funcionalidades:
1. Grid de todos os alunos com status visual:
   - 🟢 Verde: tudo ok hoje
   - 🟡 Amarelo: pendências (remédio não confirmado, humor ruim)
   - 🔴 Vermelho: alerta crítico (indicador vermelho registrado)
2. Seção "Alertas Urgentes" no topo:
   - Alunos com indicador em vermelho hoje
   - Alunos que não confirmaram remédio crítico
   - Alunos com humor "enfermo" ou "ansioso" por 3+ dias
3. Cada card de aluno mostra:
   - Foto, nome, condição clínica
   - Treinou hoje? Sim/Não
   - Humor de hoje (emoji)
   - Último indicador registrado com semáforo
   - Remédio confirmado? Sim/Não/N.A.
4. Clique no aluno: abre histórico completo
5. Atualização em tempo real via Supabase Realtime

Use Supabase Realtime subscriptions para alertas instantâneos quando aluno registra indicador vermelho.
```

---

## CONFIGURAÇÃO DO SUPABASE STORAGE

No painel do Supabase, crie os buckets:
- `videos-treino` — público, limite 100MB
- `fotos-perfil` — público, limite 5MB  
- `fotos-medicamentos` — público, limite 5MB
- `exames` — privado, limite 20MB

---

## CONFIGURAÇÃO DA VERCEL

1. Conectar repositório GitHub
2. Adicionar variáveis de ambiente
3. Framework: Next.js (auto-detectado)
4. Build command: `next build`
5. Output directory: `.next`

---

## PWA — MANIFEST.JSON

```json
{
  "name": "Central de Saúde Conectada",
  "short_name": "Saúde Conectada",
  "description": "Seu centro de treinamento no bolso",
  "start_url": "/home",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2563EB",
  "orientation": "portrait",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

