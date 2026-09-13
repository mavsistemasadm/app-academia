import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { FaixaSemaforo } from "@/components/shared/FaixaSemaforo";
import type { IndicadorTipo, SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

export const CHIP_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde-light text-[#15803d]",
  amarelo: "bg-saude-amarelo-light text-[#b45309]",
  vermelho: "bg-saude-vermelho-light text-[#b91c1c]",
};

interface CardIndicadorProps {
  icone: LucideIcon;
  /** Mantido por compatibilidade — o card novo não pinta mais o ícone. */
  corIcone?: string;
  valor: string;
  label: string;
  unidade?: string;
  status?: SemaforoStatus;
  /** Sobrescreve o texto do chip. Peso usa para mostrar o IMC. */
  badge?: string;
  /** Sem href o card é só leitura (ex.: visão do familiar). */
  href?: string;
  /** Com tipo e valor numérico, o card desenha a faixa do semáforo. */
  faixa?: { tipo: IndicadorTipo; valor: number; valorSecundario?: number | null };
  /** Sem faixa clínica: barra de progresso em trechos (ex.: treinos da semana). */
  progresso?: { feitos: number; total: number };
}

export function CardIndicador({
  icone: Icone,
  valor,
  label,
  unidade,
  status,
  badge,
  href,
  faixa,
  progresso,
}: CardIndicadorProps) {
  const semRegistro = status === undefined;
  const textoChip = badge || (status ? SEMAFORO_CONFIG[status].label : "");

  return (
    <Raiz
      href={href}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-neutral-200/90 md:p-5",
        href &&
          "transition-all duration-200 hover:shadow-[0_10px_30px_-14px_rgba(12,18,20,.25)] hover:ring-neutral-300"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-neutral-500">
          <Icone className="size-4 shrink-0 text-neutral-400" strokeWidth={1.9} aria-hidden />
          <span className="truncate">{label}</span>
        </span>
        {!semRegistro && textoChip && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              CHIP_SEMAFORO[status]
            )}
          >
            {textoChip}
          </span>
        )}
      </div>

      {semRegistro ? (
        <div className="flex flex-1 flex-col justify-end gap-1">
          <p className="text-[15px] font-medium text-neutral-400">Ainda sem medição</p>
          {href && (
            <span className="flex items-center gap-1 text-sm font-semibold text-primary">
              Registrar
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          )}
        </div>
      ) : (
        <>
          <p className="numero text-[28px] leading-none font-semibold text-neutral-950 md:text-[32px]">
            {valor}
            {unidade && (
              <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                {unidade}
              </span>
            )}
          </p>

          {faixa && (
            <FaixaSemaforo
              tipo={faixa.tipo}
              valor={faixa.valor}
              valorSecundario={faixa.valorSecundario}
              className="mt-1"
            />
          )}

          {progresso && progresso.total > 0 && (
            <div aria-hidden className="mt-1 flex h-1.5 gap-[3px]">
              {Array.from({ length: progresso.total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-full flex-1 rounded-full",
                    i < progresso.feitos ? "bg-ciano" : "bg-neutral-200"
                  )}
                />
              ))}
            </div>
          )}
        </>
      )}
    </Raiz>
  );
}

/** Link quando há destino; senão um bloco comum, sem cara de clicável. */
function Raiz({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
}) {
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
