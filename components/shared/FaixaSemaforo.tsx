import type { IndicadorTipo, SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ESCALAS_FAIXA, largurasFaixa, posicaoNaFaixa } from "@/lib/utils/semaforo";

const CLARO: Record<SemaforoStatus, string> = {
  verde: "bg-[#cdebd7]",
  amarelo: "bg-[#f6e1bf]",
  vermelho: "bg-[#f6cccc]",
};

const CHEIO: Record<SemaforoStatus, string> = {
  verde: "bg-saude-verde",
  amarelo: "bg-saude-amarelo",
  vermelho: "bg-saude-vermelho",
};

/**
 * A régua do semáforo: verde, amarelo e vermelho na proporção real das faixas
 * clínicas, com um ponto onde a medição caiu. O trecho do ponto ganha a cor
 * cheia — é o que o olho acha primeiro. Decorativa para leitor de tela: o
 * status já vai escrito no chip ao lado.
 */
export function FaixaSemaforo({
  tipo,
  valor,
  valorSecundario,
  className,
}: {
  tipo: IndicadorTipo;
  valor: number;
  valorSecundario?: number | null;
  className?: string;
}) {
  const { cores } = ESCALAS_FAIXA[tipo];
  const larguras = largurasFaixa(tipo);
  const posicao = posicaoNaFaixa(tipo, valor, valorSecundario);

  // Onde cada trecho termina, somando as larguras; o ponto cai no primeiro que o alcança.
  const fins = larguras.map((_, i) => larguras.slice(0, i + 1).reduce((soma, l) => soma + l, 0));
  const trechoDoPonto = fins.findIndex((fim) => posicao <= fim + 1e-9);

  return (
    <div aria-hidden className={cn("relative h-1.5", className)}>
      <div className="flex h-full gap-[3px]">
        {cores.map((cor, i) => (
          <span
            key={i}
            className={cn("h-full rounded-full", i === trechoDoPonto ? CHEIO[cor] : CLARO[cor])}
            style={{ width: `${larguras[i] * 100}%` }}
          />
        ))}
      </div>
      <span
        className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-grafite shadow-[0_1px_4px_rgba(12,18,20,.35)]"
        style={{ left: `${Math.min(97, Math.max(3, posicao * 100))}%` }}
      />
    </div>
  );
}
