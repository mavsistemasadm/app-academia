"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Marca no user_metadata — vale em qualquer aparelho em que o aluno entrar. */
const CHAVE_VISTO = "av-tour-visto-v1";

interface Passo {
  alvo: string;
  titulo: string;
  texto: string;
}

const PASSOS: Passo[] = [
  {
    alvo: "saudacao",
    titulo: "Seu dia começa aqui",
    texto: "A data de hoje e um recado do centro pensado para o seu momento.",
  },
  {
    alvo: "foco",
    titulo: "Foco de hoje",
    texto:
      "A coisa mais importante do dia aparece neste cartão: um indicador fora da faixa, um medicamento atrasado ou o seu treino.",
  },
  {
    alvo: "checkin",
    titulo: "Check-in e treino",
    texto:
      "Chegou na academia? Toque em Cheguei. Logo abaixo fica o treino que seu professor montou para hoje.",
  },
  {
    alvo: "indicadores",
    titulo: "Seus indicadores",
    texto:
      "Pressão, glicemia e peso com a faixa do semáforo. O ponto mostra onde sua última medição caiu.",
  },
  {
    alvo: "humor",
    titulo: "Como você está",
    texto:
      "Registre seu humor num toque: seu professor vê e ajusta o treino. Ao lado ficam os atalhos do dia a dia.",
  },
  {
    alvo: "sino",
    titulo: "Avisos do centro",
    texto: "Comunicados, lembretes e mensagens do seu professor chegam no sininho.",
  },
  {
    alvo: "navegacao",
    titulo: "Tudo a um toque",
    texto: "Treino, saúde, medicamentos e perfil sempre por aqui. Bom treino!",
  },
];

/** O primeiro elemento com esse `data-tour` que está visível na tela. */
function acharAlvo(alvo: string): HTMLElement | null {
  const candidatos = document.querySelectorAll<HTMLElement>(`[data-tour="${alvo}"]`);
  for (const el of candidatos) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Tour de boas-vindas da home do aluno. Abre sozinho na primeira vez (ou com
 * `?tour=1` na URL, para rever pelo perfil), recorta o elemento de cada passo
 * e grava no usuário que já viu ao fechar.
 */
export function TourGuiado() {
  const [ativo, setAtivo] = useState(false);
  const [passo, setPasso] = useState(-1); // -1 = boas-vindas
  const [caixa, setCaixa] = useState<DOMRect | null>(null);

  const pathname = usePathname();

  // Decide se abre: a leitura do usuário é assíncrona, então o setState vem no callback.
  // Só na home — é onde moram os elementos que o tour aponta.
  useEffect(() => {
    if (pathname !== "/home") return;
    const forcar = new URLSearchParams(window.location.search).get("tour") === "1";
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user && (forcar || !user.user_metadata?.[CHAVE_VISTO])) setAtivo(true);
      });
  }, [pathname]);

  // Passos cujo alvo não existe nesta tela (ex.: sem sino) são pulados.
  const passosVisiveis = useCallback(
    () => PASSOS.filter((p) => acharAlvo(p.alvo) !== null),
    []
  );
  const [lista, setLista] = useState<Passo[]>(PASSOS);

  const medir = useCallback(() => {
    const atual = lista[passo];
    const el = atual ? acharAlvo(atual.alvo) : null;
    setCaixa(el ? el.getBoundingClientRect() : null);
  }, [lista, passo]);

  // Rola até o alvo e mede depois que a rolagem assenta.
  useEffect(() => {
    if (!ativo || passo < 0) return;
    const el = acharAlvo(lista[passo]?.alvo ?? "");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(medir, 380);

    const aoMover = () => requestAnimationFrame(medir);
    window.addEventListener("resize", aoMover);
    window.addEventListener("scroll", aoMover, { passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", aoMover);
      window.removeEventListener("scroll", aoMover);
    };
  }, [ativo, passo, lista, medir]);

  const fechar = useCallback(async () => {
    setAtivo(false);
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { [CHAVE_VISTO]: true } });
    // Tira o ?tour=1 da URL sem recarregar.
    if (window.location.search.includes("tour=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!ativo) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ativo, fechar]);

  if (!ativo) return null;

  function comecar() {
    setLista(passosVisiveis());
    setCaixa(null);
    setPasso(0);
  }

  function avancar() {
    if (passo >= lista.length - 1) {
      fechar();
      return;
    }
    setCaixa(null);
    setPasso((p) => p + 1);
  }

  function voltar() {
    setCaixa(null);
    setPasso((p) => Math.max(0, p - 1));
  }

  /* ── Boas-vindas ─────────────────────────────────────────────────── */
  if (passo === -1) {
    return (
      <div className="fixed inset-0 z-[90] flex items-end justify-center bg-grafite/60 p-4 backdrop-blur-sm sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-titulo"
          className="relative w-full max-w-sm animate-surgir overflow-hidden rounded-[30px] bg-card p-7 text-center shadow-[0_40px_90px_-20px_rgba(12,18,20,.5)]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -top-28 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,180,203,.22),transparent_65%)]"
          />
          <Image
            src="/marca/simbolo.png"
            alt=""
            width={512}
            height={512}
            className="relative mx-auto size-16"
          />
          <p className="rotulo relative mt-5 text-primary">Boas-vindas</p>
          <h2
            id="tour-titulo"
            className="relative mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-neutral-950"
          >
            Que bom ter você na Atitude Vital
          </h2>
          <p className="relative mx-auto mt-3 max-w-[32ch] text-[15px] leading-relaxed text-neutral-500">
            Em {PASSOS.length} passos rápidos você conhece o app que acompanha
            sua saúde todos os dias.
          </p>

          <div aria-hidden className="relative mt-6 flex justify-center gap-1.5">
            {PASSOS.map((p) => (
              <span key={p.alvo} className="h-1.5 w-6 rounded-full bg-neutral-200" />
            ))}
          </div>

          <div className="relative mt-7 flex flex-col gap-2">
            <button
              type="button"
              onClick={comecar}
              autoFocus
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-grafite text-[15px] font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Começar o tour
              <ArrowRight className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={fechar}
              className="flex h-11 items-center justify-center rounded-full text-sm font-semibold text-neutral-500 transition-colors hover:text-neutral-950"
            >
              Agora não
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Passo com recorte ───────────────────────────────────────────── */
  const atual = lista[passo];
  const ultimo = passo === lista.length - 1;
  const margem = 8;

  // Balão embaixo do alvo quando ele está na metade de cima; senão, em cima.
  const alvoEmCima = caixa ? caixa.top + caixa.height / 2 < window.innerHeight / 2 : true;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="tour-passo-titulo">
      {/* Recorte: a sombra gigante escurece tudo menos o retângulo do alvo. */}
      {caixa ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[24px] shadow-[0_0_0_9999px_rgba(12,18,20,.62)] ring-2 ring-ciano transition-all duration-300 ease-out"
          style={{
            top: caixa.top - margem,
            left: caixa.left - margem,
            width: caixa.width + margem * 2,
            height: caixa.height + margem * 2,
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-grafite/60" />
      )}

      {/* Clique fora não fecha sem querer: só bloqueia a página por baixo. */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        key={passo}
        className={cn(
          "fixed inset-x-4 mx-auto w-auto max-w-sm animate-surgir rounded-[24px] bg-card p-5 shadow-[0_30px_70px_-20px_rgba(12,18,20,.55)] ring-1 ring-neutral-200/60",
          !caixa && "top-1/2 -translate-y-1/2"
        )}
        style={
          caixa
            ? alvoEmCima
              ? { top: Math.min(caixa.bottom + margem + 14, window.innerHeight - 230) }
              : { bottom: Math.min(window.innerHeight - caixa.top + margem + 14, window.innerHeight - 230) }
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-3">
          <p className="rotulo text-primary">
            Passo {passo + 1} de {lista.length}
          </p>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar tour"
            className="flex size-9 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <h2
          id="tour-passo-titulo"
          className="mt-1 text-xl leading-snug font-semibold tracking-[-0.02em] text-neutral-950"
        >
          {atual.titulo}
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-500">{atual.texto}</p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div aria-hidden className="flex gap-1">
            {lista.map((p, i) => (
              <span
                key={p.alvo}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === passo ? "w-5 bg-ciano" : i < passo ? "w-1.5 bg-primary/40" : "w-1.5 bg-neutral-200"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {passo > 0 && (
              <button
                type="button"
                onClick={voltar}
                aria-label="Passo anterior"
                className="flex size-11 items-center justify-center rounded-full text-neutral-600 ring-1 ring-neutral-200 transition-colors hover:bg-neutral-50"
              >
                <ArrowLeft className="size-4" aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={avancar}
              autoFocus
              className="flex h-11 items-center gap-1.5 rounded-full bg-grafite px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              {ultimo ? "Concluir" : "Próximo"}
              {!ultimo && <ArrowRight className="size-4" aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
