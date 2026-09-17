"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PerguntaAnamnese, Resposta } from "@/lib/utils/anamnese";

const PILULA =
  "rounded-full text-sm font-medium transition-all duration-200 active:scale-[.98]";
const PILULA_MARCADA = "bg-grafite text-white";
const PILULA_LIVRE =
  "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-100";
const ENUNCIADO = "text-sm leading-snug font-medium text-neutral-700";

interface CampoAnamneseProps {
  pergunta: Pick<PerguntaAnamnese, "id" | "enunciado" | "ajuda" | "tipo" | "opcoes" | "obrigatoria">;
  valor: Resposta | null;
  onMudar: (valor: Resposta | null) => void;
  desabilitado?: boolean;
}

/**
 * Uma pergunta da anamnese, desenhada pelo tipo. O formulário do aluno e a
 * prévia do editor do professor usam o mesmo campo, então o professor vê
 * exatamente o que o aluno vai ver.
 */
export function CampoAnamnese({ pergunta, valor, onMudar, desabilitado = false }: CampoAnamneseProps) {
  const { id, tipo, opcoes, ajuda } = pergunta;
  const campoId = `pergunta-${id}`;

  const enunciado = (
    <>
      {pergunta.enunciado || "Pergunta sem texto"}
      {pergunta.obrigatoria && (
        <span className="text-saude-vermelho" aria-hidden>
          {" "}*
        </span>
      )}
      {tipo === "multipla_escolha" && (
        <span className="font-normal text-neutral-400"> (marque quantas quiser)</span>
      )}
    </>
  );

  if (tipo === "texto_curto" || tipo === "texto_longo" || tipo === "numero" || tipo === "data") {
    const texto = valor === null ? "" : String(valor);

    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={campoId} className={ENUNCIADO}>
          {enunciado}
        </label>

        {tipo === "texto_longo" ? (
          <textarea
            id={campoId}
            rows={3}
            value={texto}
            onChange={(e) => onMudar(e.target.value || null)}
            placeholder={ajuda ?? undefined}
            disabled={desabilitado}
            aria-required={pergunta.obrigatoria}
            className="w-full resize-none rounded-[14px] border border-input bg-card px-4 py-3 text-base transition-colors outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          />
        ) : (
          <Input
            id={campoId}
            type={tipo === "data" ? "date" : "text"}
            inputMode={tipo === "numero" ? "decimal" : undefined}
            value={tipo === "numero" ? texto.replace(".", ",") : texto}
            onChange={(e) => {
              const bruto = e.target.value;
              if (tipo !== "numero") return onMudar(bruto || null);
              // Guarda o que foi digitado enquanto não vira número ("72," no meio da digitação).
              const limpo = bruto.replace(/[^\d,.-]/g, "");
              if (!limpo) return onMudar(null);
              const numero = Number(limpo.replace(",", "."));
              onMudar(Number.isFinite(numero) && !/[,.]$/.test(limpo) ? numero : limpo);
            }}
            placeholder={tipo === "data" ? undefined : (ajuda ?? undefined)}
            disabled={desabilitado}
            aria-required={pergunta.obrigatoria}
            className={cn("h-12 rounded-[14px] px-4 text-base", tipo !== "texto_curto" && "max-w-[220px]")}
          />
        )}

        {tipo === "data" && ajuda && <p className="text-[13px] text-neutral-500">{ajuda}</p>}
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2.5" disabled={desabilitado}>
      <legend className={cn(ENUNCIADO, "mb-2.5")}>{enunciado}</legend>
      {ajuda && <p className="-mt-1.5 mb-1 text-[13px] text-neutral-500">{ajuda}</p>}

      {tipo === "sim_nao" && (
        <div className="flex gap-2">
          {[
            { texto: "Sim", escolha: true },
            { texto: "Não", escolha: false },
          ].map(({ texto, escolha }) => (
            <button
              key={texto}
              type="button"
              onClick={() => onMudar(valor === escolha ? null : escolha)}
              aria-pressed={valor === escolha}
              className={cn(PILULA, "h-12 w-24", valor === escolha ? PILULA_MARCADA : PILULA_LIVRE)}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {tipo === "escala" && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-6 gap-1.5 sm:flex sm:flex-wrap">
            {Array.from({ length: 11 }, (_, nota) => (
              <button
                key={nota}
                type="button"
                onClick={() => onMudar(valor === nota ? null : nota)}
                aria-pressed={valor === nota}
                aria-label={`${nota} de 10`}
                className={cn(
                  PILULA,
                  "numero h-11 sm:w-11",
                  valor === nota ? PILULA_MARCADA : PILULA_LIVRE
                )}
              >
                {nota}
              </button>
            ))}
          </div>
          <div className="rotulo flex justify-between text-neutral-400 sm:max-w-[564px]">
            <span>0 nada</span>
            <span>10 muito</span>
          </div>
        </div>
      )}

      {(tipo === "escolha_unica" || tipo === "multipla_escolha") && (
        <div className="flex flex-wrap gap-2">
          {opcoes.filter((o) => o.trim()).map((opcao) => {
            const marcadas = Array.isArray(valor) ? valor : typeof valor === "string" ? [valor] : [];
            const marcada = marcadas.includes(opcao);

            return (
              <button
                key={opcao}
                type="button"
                onClick={() => {
                  if (tipo === "escolha_unica") return onMudar(marcada ? null : opcao);
                  const novas = marcada ? marcadas.filter((m) => m !== opcao) : [...marcadas, opcao];
                  onMudar(novas.length > 0 ? novas : null);
                }}
                aria-pressed={marcada}
                className={cn(PILULA, "min-h-11 px-4 py-2 text-left", marcada ? PILULA_MARCADA : PILULA_LIVRE)}
              >
                {opcao}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
