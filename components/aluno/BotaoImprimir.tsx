"use client";

import { Printer } from "lucide-react";

/**
 * Sem biblioteca de PDF: a impressão do navegador já gera um arquivo, e no
 * celular ("Compartilhar → Imprimir → Salvar em PDF") o resultado é o mesmo
 * — com a vantagem de o aluno poder mandar direto pelo WhatsApp.
 */
export function BotaoImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-grafite px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98] sm:w-auto print:hidden"
    >
      <Printer className="size-5" strokeWidth={1.8} aria-hidden />
      Salvar em PDF ou imprimir
    </button>
  );
}
