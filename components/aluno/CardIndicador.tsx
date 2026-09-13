import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const CORES_SEMAFORO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde-light text-saude-verde",
  amarelo: "bg-saude-amarelo-light text-saude-amarelo",
  vermelho: "bg-saude-vermelho-light text-saude-vermelho",
};

interface CardIndicadorProps {
  icone: LucideIcon;
  /** Cor do quadradinho do ícone — identidade do indicador, não o semáforo. */
  corIcone: string;
  valor: string;
  label: string;
  status?: SemaforoStatus;
  /** Sobrescreve o texto do badge. Peso usa para mostrar o IMC. */
  badge?: string;
  href: string;
}

export function CardIndicador({
  icone: Icone,
  corIcone,
  valor,
  label,
  status,
  badge,
  href,
}: CardIndicadorProps) {
  const semRegistro = status === undefined;
  const textoBadge = badge || (status ? SEMAFORO_CONFIG[status].label : "");

  return (
    <Link
      href={href}
      className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          corIcone
        )}
      >
        <Icone className="size-5" aria-hidden />
      </span>

      <p
        className={cn(
          "text-2xl leading-tight font-bold tracking-tight",
          semRegistro ? "text-neutral-300" : "text-neutral-900"
        )}
      >
        {semRegistro ? "—" : valor}
      </p>

      <p className="text-sm text-neutral-500">{label}</p>

      {semRegistro ? (
        <span className="w-fit rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-400">
          Sem registro
        </span>
      ) : (
        <span
          className={cn(
            "w-fit rounded-md px-2 py-0.5 text-xs font-semibold",
            CORES_SEMAFORO[status]
          )}
        >
          {textoBadge}
        </span>
      )}
    </Link>
  );
}
