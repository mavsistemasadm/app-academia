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
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-white transition-opacity hover:opacity-90 print:hidden"
    >
      <Printer className="size-5" aria-hidden />
      Salvar em PDF ou imprimir
    </button>
  );
}
