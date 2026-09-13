import { cn } from "@/lib/utils";

/** Bloco cinza pulsando no lugar do conteúdo que ainda está chegando. */
export function Bloco({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-2xl bg-neutral-200/70", className)} />;
}

/**
 * Esqueleto genérico de tela: cabeçalho, um card de destaque e uma lista.
 * Aparece na hora do toque, então a navegação nunca parece travada.
 */
export function EsqueletoTela({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn("flex flex-col gap-7 px-5 pt-7 md:gap-9 md:px-8 md:pt-10", className)}
    >
      <div className="flex flex-col gap-2.5">
        <Bloco className="h-3 w-24 rounded-full" />
        <Bloco className="h-8 w-56 rounded-xl" />
        <Bloco className="h-4 w-72 max-w-full rounded-full" />
      </div>
      <Bloco className="h-40 rounded-[26px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Bloco className="h-28" />
        <Bloco className="h-28" />
        <Bloco className="h-28" />
        <Bloco className="h-28" />
      </div>
      <div className="flex flex-col gap-3">
        <Bloco className="h-16" />
        <Bloco className="h-16" />
        <Bloco className="h-16" />
      </div>
    </div>
  );
}
