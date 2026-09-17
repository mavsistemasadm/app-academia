"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Bell,
  BellRing,
  CalendarDays,
  CalendarX,
  HeartPulse,
  Megaphone,
  MessageCircle,
  Pill,
  Smile,
  X,
  type LucideIcon,
} from "lucide-react";

import type {
  ItemNotificacao,
  TipoNotificacao,
} from "@/lib/supabase/notificacoes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { hojeISO, naAcademia, somarDiasISO } from "@/lib/utils/datas";

const ICONE: Record<TipoNotificacao, LucideIcon> = {
  comunicado: Megaphone,
  medicamento: Pill,
  evento: CalendarDays,
  mensagem: MessageCircle,
  indicador: HeartPulse,
  humor: Smile,
  frequencia: CalendarX,
};

/*
  "Visto" mora no localStorage, por usuário: é o instante (ms) da última vez
  que o painel foi aberto. Lido por useSyncExternalStore para não precisar de
  efeito nem quebrar a hidratação — no servidor o valor é desconhecido e o
  badge simplesmente não aparece até o cliente assumir.
*/
const EVENTO_VISTO = "av-sino-visto";
const NO_SERVIDOR = "__servidor__";

function assinarVisto(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_VISTO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_VISTO, avisar);
  };
}

function lerVisto(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarVisto(chave: string, instante: number) {
  try {
    window.localStorage.setItem(chave, String(instante));
  } catch {
    // Aba anônima ou armazenamento bloqueado: o badge só não lembra.
  }
  window.dispatchEvent(new Event(EVENTO_VISTO));
}

const instante = (iso: string) => Date.parse(iso) || 0;

function naoVisto(item: ItemNotificacao, visto: number | null) {
  return visto === null || instante(item.criadoEm) > visto;
}

function tempoRelativo(iso: string, agora: number) {
  const quando = instante(iso);
  const minutos = Math.floor((agora - quando) / 60_000);

  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const hoje = hojeISO(new Date(agora));
  const dia = hojeISO(new Date(quando));

  if (dia === hoje) return `há ${Math.floor(minutos / 60)} h`;
  if (dia === somarDiasISO(hoje, -1)) return "ontem";

  const dias = Math.round(
    (Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) /
      86_400_000
  );
  if (dias < 7) return `há ${dias} dias`;

  return format(naAcademia(iso), "dd/MM");
}

interface ListaProps {
  itens: ItemNotificacao[];
  vistoAntes: number | null;
  agora: number;
  aoEscolher: () => void;
}

function ListaNotificacoes({ itens, vistoAntes, agora, aoEscolher }: ListaProps) {
  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <BellRing className="size-6 text-neutral-300" strokeWidth={1.8} aria-hidden />
        <p className="mt-3 text-[15px] font-semibold text-neutral-950">
          Tudo em dia por aqui
        </p>
        <p className="mt-1 max-w-[260px] text-sm leading-relaxed text-neutral-500">
          Comunicados, lembretes e mensagens novas aparecem aqui assim que chegarem.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-neutral-200/80">
      {itens.map((item) => {
        const Icone = ICONE[item.tipo] ?? Bell;
        const novo = naoVisto(item, vistoAntes);

        return (
          <li key={item.id}>
            <Link
              href={item.href}
              onClick={aoEscolher}
              className={cn(
                "flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-neutral-50",
                novo && "bg-accent/40"
              )}
            >
              <Icone
                className="mt-0.5 size-5 shrink-0 text-neutral-400"
                strokeWidth={1.8}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  {item.urgente && (
                    <span
                      className="size-2 shrink-0 rounded-full bg-saude-vermelho"
                      aria-label="Urgente"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-neutral-950">
                    {item.titulo}
                  </span>
                  <span className="rotulo shrink-0 text-neutral-400">
                    {tempoRelativo(item.criadoEm, agora)}
                  </span>
                </span>
                <span className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-neutral-500">
                  {item.texto}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

interface CabecalhoProps {
  novas: number;
  aoFechar?: () => void;
}

function CabecalhoPainel({ novas, aoFechar }: CabecalhoProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200/80 px-5 py-3.5">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
          Notificações
        </h2>
        {novas > 0 && (
          <span className="text-[13px] text-neutral-500">
            {novas} {novas === 1 ? "nova" : "novas"}
          </span>
        )}
      </div>
      {aoFechar && (
        <button
          type="button"
          onClick={aoFechar}
          aria-label="Fechar notificações"
          className="flex size-10 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950"
        >
          <X className="size-5" strokeWidth={1.9} aria-hidden />
        </button>
      )}
    </div>
  );
}

interface SinoNotificacoesProps {
  itens: ItemNotificacao[];
  usuarioId: string;
  /** Decide o canal de realtime: comunicados (aluno) ou alertas (professor). */
  papel: "aluno" | "professor";
}

interface EstadoAberto {
  /** Rota em que foi aberto — mudou de rota, o painel está fechado. */
  caminho: string;
  vistoAntes: number | null;
  agora: number;
}

export function SinoNotificacoes({ itens, usuarioId, papel }: SinoNotificacoesProps) {
  const router = useRouter();
  const pathname = usePathname();
  const idUnico = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [, iniciarTransicao] = useTransition();

  const chave = `av-sino-visto-${usuarioId}`;
  const bruto = useSyncExternalStore(
    assinarVisto,
    () => lerVisto(chave),
    () => NO_SERVIDOR
  );
  const carregado = bruto !== NO_SERVIDOR;
  const visto = carregado && bruto ? Number(bruto) : null;

  const [aberto, setAberto] = useState<EstadoAberto | null>(null);
  const estaAberto = aberto !== null && aberto.caminho === pathname;

  const containerRef = useRef<HTMLDivElement>(null);
  const folhaRef = useRef<HTMLDivElement>(null);

  const naoVistas = carregado ? itens.filter((i) => naoVisto(i, visto)) : [];
  const temUrgente = naoVistas.some((i) => i.urgente);
  const total = naoVistas.length;

  function fechar() {
    setAberto(null);
  }

  function alternar() {
    if (estaAberto) {
      fechar();
      return;
    }

    const agora = Date.now();
    const maisRecente = itens.reduce((m, i) => Math.max(m, instante(i.criadoEm)), 0);

    setAberto({ caminho: pathname, vistoAntes: visto, agora });
    // Relógio do celular atrasado não pode deixar item eternamente "novo".
    gravarVisto(chave, Math.max(agora, maisRecente));
  }

  // Esc e clique fora fecham. Os refs cobrem o popover e a folha (em portal).
  useEffect(() => {
    if (!estaAberto) return;

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === "Escape") setAberto(null);
    }
    function aoTocar(evento: PointerEvent) {
      const alvo = evento.target as Node;
      if (containerRef.current?.contains(alvo)) return;
      if (folhaRef.current?.contains(alvo)) return;
      setAberto(null);
    }

    document.addEventListener("keydown", aoTeclar);
    document.addEventListener("pointerdown", aoTocar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.removeEventListener("pointerdown", aoTocar);
    };
  }, [estaAberto]);

  /*
    Realtime só avisa que algo mudou; quem monta a lista é o servidor. Assim
    a regra de "vale para este aluno" não precisa existir duas vezes.
  */
  useEffect(() => {
    const supabase = createClient();
    const recarregar = () => iniciarTransicao(() => router.refresh());

    const canal = supabase.channel(`sino-${usuarioId}-${idUnico}`);

    if (papel === "professor") {
      canal.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alertas_professor",
          filter: `professor_id=eq.${usuarioId}`,
        },
        recarregar
      );
    } else {
      canal.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        recarregar
      );
    }

    canal
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `para=eq.${usuarioId}`,
        },
        recarregar
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [papel, usuarioId, idUnico, router]);

  const rotuloBotao =
    total > 0
      ? `Notificações: ${total} ${total === 1 ? "não vista" : "não vistas"}`
      : "Notificações";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={rotuloBotao}
        aria-expanded={estaAberto}
        aria-haspopup="dialog"
        data-tour="sino"
        className="relative flex size-11 items-center justify-center rounded-full bg-card text-neutral-600 ring-1 ring-neutral-200/90 transition-colors hover:text-neutral-950"
      >
        <Bell className="size-5" strokeWidth={1.9} aria-hidden />
        {total > 0 && (
          <span
            aria-hidden
            className={cn(
              "numero absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] leading-none font-semibold ring-2 ring-background",
              temUrgente ? "bg-saude-vermelho text-white" : "bg-ciano text-grafite"
            )}
          >
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {estaAberto && aberto && (
        <>
          {/* Desktop: popover alinhado à direita do sino. */}
          <div
            role="dialog"
            aria-label="Notificações"
            className="absolute top-full right-0 z-50 mt-2 hidden w-[380px] flex-col overflow-hidden rounded-[22px] bg-card shadow-[0_24px_60px_-18px_rgba(12,18,20,.35)] ring-1 ring-neutral-200/90 md:flex"
          >
            <CabecalhoPainel novas={naoVistasNoPainel(itens, aberto.vistoAntes)} />
            <div className="max-h-[min(70vh,520px)] overflow-y-auto overscroll-contain">
              <ListaNotificacoes
                itens={itens}
                vistoAntes={aberto.vistoAntes}
                agora={aberto.agora}
                aoEscolher={fechar}
              />
            </div>
          </div>

          {/*
            Celular: folha que sobe de baixo. Vai em portal porque o cabeçalho
            do professor tem backdrop-blur, que prende `fixed` dentro dele.
          */}
          {createPortal(
            <div className="md:hidden">
              <div aria-hidden className="fixed inset-0 z-[90] bg-grafite/45" />
              <div
                ref={folhaRef}
                role="dialog"
                aria-modal="true"
                aria-label="Notificações"
                className="fixed inset-x-0 bottom-0 z-[91] flex max-h-[85dvh] flex-col rounded-t-[26px] bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_40px_-12px_rgba(12,18,20,.35)]"
              >
                <span
                  aria-hidden
                  className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-neutral-200"
                />
                <CabecalhoPainel
                  novas={naoVistasNoPainel(itens, aberto.vistoAntes)}
                  aoFechar={fechar}
                />
                <div className="overflow-y-auto overscroll-contain pb-3">
                  <ListaNotificacoes
                    itens={itens}
                    vistoAntes={aberto.vistoAntes}
                    agora={aberto.agora}
                    aoEscolher={fechar}
                  />
                </div>
              </div>
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
}

function naoVistasNoPainel(itens: ItemNotificacao[], vistoAntes: number | null) {
  return itens.filter((i) => naoVisto(i, vistoAntes)).length;
}
