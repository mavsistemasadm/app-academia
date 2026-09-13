# Linguagem visual — Atitude Vital

Direção aprovada em 13/09/2026. Referências: Oura (uma coisa em foco por dia),
Gentler Streak (faixa saudável em vez de número solto), Apple Saúde (número
grande, unidade pequena), The Outsiders/Harvee (prontidão para treinar),
Calm/Headspace (bem-estar escuro).

A regra de ouro: **um destaque por tela**. O resto é branco sobre névoa.

---

## Tokens (já em `app/globals.css`)

| Uso | Classe | Valor |
|---|---|---|
| Fundo do app | `bg-background` | névoa `#F3F6F6` |
| Card | `bg-card` | `#FFFFFF` |
| Destaque escuro | `bg-grafite` | `#0F1618` |
| Marca viva (ícone ativo, anel, ponto) | `bg-ciano` / `text-ciano` | `#00B4CB` |
| Botão, link, foco | `bg-primary` / `text-primary` | `#0A8FA3` (texto branco passa) |
| Cinzas | `neutral-50…950` | trocados por cinzas com fio de ciano |
| Semáforo | `saude-verde/amarelo/vermelho(-light)` | inalterado |

**Proibido:** `blue-*`, `sky-*`, `violet-*`, `#2563EB`, e `bg-primary` como fundo de bloco grande.
Para cor de identidade de gráfico, use `var(--ciano)`, `var(--primary)`, `#5C6466` e `#0F1618`.

## Tipografia

- **Sora** (`font-display`) — `h1`, `h2`, `h3` já saem nela pelo CSS base. Números clínicos com a utilidade **`numero`** (Sora + tabular + tracking fechado).
- **Inter** (`font-sans`) — texto corrido, formulários, botões.
- **Geist Mono** (`font-mono`) — horários, unidades e rótulos de seção com a utilidade **`rotulo`** (11px, caixa-alta, espaçado).

Escala:
- Título de tela: `text-[28px] md:text-[34px] font-semibold tracking-[-0.03em]` (use `CabecalhoPagina`)
- Título de seção: `text-lg md:text-xl font-semibold tracking-[-0.02em] text-neutral-950`
- Título de card: `text-lg font-semibold tracking-[-0.02em]`
- Número de destaque: `numero text-[28px] md:text-[32px] font-semibold leading-none`
- Unidade ao lado do número: `ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400`
- Texto: `text-[15px] leading-relaxed text-neutral-500`
- Rótulo: `rotulo text-neutral-400` (ou `text-primary` quando for eyebrow de tela)

**Não usar mais** o rótulo antigo `text-xs font-semibold tracking-wider text-neutral-500 uppercase` como título de seção — troque por título de seção em Sora.

## Formas

| Papel | Raio | Como |
|---|---|---|
| Card principal | `rounded-2xl` (~22px) | `bg-card ring-1 ring-neutral-200/90` |
| Destaque escuro | `rounded-[26px]` | `bg-grafite text-white` + brilho radial ciano opcional |
| Campo, select, textarea | `rounded-[14px]` | já no `Input` |
| Botão de ação principal | `rounded-full`, `h-12` | `bg-primary text-white` ou `bg-grafite text-white` |
| Chip de status, filtro, abas | `rounded-full` | `px-2.5 py-0.5 text-[11px] font-semibold` |

- **Borda é `ring-1 ring-neutral-200/90`**, não `border border-neutral-200`.
- **Sombra só no que flutua** (barra inferior, menu, diálogo) ou no hover de card clicável: `hover:shadow-[0_10px_30px_-14px_rgba(12,18,20,.25)]`.
- **Nada de ícone dentro de quadradinho colorido** (`size-9 rounded-lg bg-x-50`). Ícone vai solto, `text-neutral-400`, `strokeWidth={1.8}`, só onde ajuda a achar algo.
- Lista de itens parecidos = **um card com `divide-y`**, não uma pilha de cards.
- Seleção (humor, abas, filtros, dia da semana): selecionado `bg-grafite text-white`; não selecionado `bg-neutral-50 hover:bg-neutral-100` ou `ring-1 ring-neutral-200`.

## Semáforo

- Chip: `CHIP_SEMAFORO[status]` exportado de `components/aluno/CardIndicador.tsx`.
- Faixa: `<FaixaSemaforo tipo valor valorSecundario />` de `components/shared/FaixaSemaforo.tsx`. Use sempre que um indicador aparecer com valor (card, histórico, portão pré-treino, ficha do aluno).
- Alerta vermelho em lista: ponto `size-2 rounded-full bg-saude-vermelho` + texto; fundo `bg-saude-vermelho-light` só quando for o destaque da tela.

## Estrutura de uma tela do aluno

```tsx
<div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
  <CabecalhoPagina rotulo="Saúde" titulo="Indicadores" descricao="…" />
  <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
    <section className="flex flex-col gap-3.5">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">…</h2>
      …
    </section>
  </div>
</div>
```

- O bloco azul `rounded-b-3xl bg-primary …` sai de todas as telas; o `-mt-14` que puxava o conteúdo para cima dele também.
- O layout do aluno já dá `max-w-6xl` e `pb-28` (barra flutuante).
- Telas do professor: `mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8`, mesmo cabeçalho e mesmas regras.

## Estados

- **Vazio convida**: em vez de "—" ou "Nenhum registro", diga o que fazer: "Ainda sem medição hoje" + link "Registrar →" em `text-primary`.
- **Erro**: `text-sm text-saude-vermelho`, frase que diz como resolver.
- **Carregando**: `Loader2 animate-spin` dentro do próprio botão.

## Movimento

- `transition-all duration-200` em hover/seleção. Botão aperta com `active:scale-[.98]`.
- Nada anima sozinho, exceto a respiração guiada. `prefers-reduced-motion` já é respeitado globalmente.

## Onde o escuro mora

Só três lugares usam `bg-grafite` em área grande: o **Foco de hoje** da home, a **barra inferior** e a tela de **bem-estar** (respiração/aterramento). Botão escuro pode aparecer em qualquer tela.

## 60+ e cardiopata

Toque mínimo de 48px (`h-12`) em ação principal, número de destaque nunca abaixo de 28px, texto nunca abaixo de 13px.

## Regras que continuam valendo

- Fuso: nada de `new Date()` para decidir "hoje" — `lib/utils/datas.ts`. Para formatar uma data ISO `YYYY-MM-DD`, use `new Date(\`${iso}T12:00:00Z\`)`.
- Horário de registro (`created_at`) formatado no servidor sai em UTC: formate em componente client ou use os helpers de `datas.ts`.
- Não mudar lógica, consultas ou props públicas sem necessidade — o trabalho é visual.
