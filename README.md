# Central de Saúde Conectada

PWA de saúde para centro de treinamento personalizado.

---

## SETUP — PASSO A PASSO

### 1. Clonar e instalar

```bash
# Criar projeto Next.js na pasta atual
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --import-alias="@/*" \
  --no-src-dir

# Instalar dependências do projeto
npm install @supabase/supabase-js @supabase/ssr \
  @supabase/auth-ui-react @supabase/auth-ui-shared \
  recharts date-fns web-push lucide-react \
  next-pwa sharp clsx tailwind-merge \
  class-variance-authority \
  @radix-ui/react-avatar @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu @radix-ui/react-label \
  @radix-ui/react-select @radix-ui/react-slot \
  @radix-ui/react-toast @radix-ui/react-tabs \
  @radix-ui/react-progress

npm install -D @types/web-push tailwindcss-animate

# Instalar shadcn/ui
npx shadcn@latest init
# Escolher: Default, Slate, CSS variables: yes

# Adicionar componentes shadcn
npx shadcn@latest add button card input label \
  toast badge avatar tabs progress dialog \
  dropdown-menu select
```

### 2. Configurar Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um projeto
2. Vá em **SQL Editor** e cole todo o conteúdo de `supabase/migrations/001_schema_inicial.sql`
3. Execute o SQL
4. Vá em **Settings > API** e copie:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY`

### 3. Configurar variáveis de ambiente

```bash
# Copiar template
cp .env.local .env.local

# Editar com suas chaves reais
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
```

### 4. Gerar chaves VAPID (notificações push)

```bash
npx web-push generate-vapid-keys
# Copie as chaves para o .env.local
```

### 5. Rodar em desenvolvimento

```bash
npm run dev
# Acesse http://localhost:3000
```

### 6. Deploy na Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel

# Adicionar variáveis de ambiente na Vercel:
# Settings > Environment Variables
# Adicionar todas as do .env.local
```

---

## ESTRUTURA DO PROJETO

```
app/
  (auth)/           → login e cadastro
  (aluno)/          → área do aluno
  (professor)/      → área do professor
components/         → componentes reutilizáveis
lib/
  supabase/         → clientes Supabase
  utils/            → semáforo, saudação, notificações
  types/            → tipos TypeScript
supabase/
  migrations/       → SQL do banco de dados
```

---

## DESENVOLVIMENTO COM CLAUDE NO VS CODE

O arquivo `CLAUDE.md` contém todas as instruções para o Claude entender o projeto.

Ao abrir o VS Code com Claude, ele vai ler o CLAUDE.md automaticamente e já vai conhecer:
- A stack e estrutura do projeto
- As tabelas do banco
- As regras de UX e segurança
- Os tipos TypeScript
- As faixas clínicas do semáforo

**Exemplo de como pedir ajuda:**
```
Crie a tela /app/(aluno)/indicadores/page.tsx.
O aluno deve conseguir registrar glicemia, pressão e peso.
Após salvar, mostrar o semáforo. Se vermelho, criar alerta em alertas_professor.
```
