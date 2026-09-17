"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { RegistroDesafio as Registro } from "@/lib/supabase/desafios";
import { formatarQuantidade, METRICAS, type Metrica } from "@/lib/utils/desafios";

/**
 * Onde o aluno soma o que o app não tem como saber: hoje, quilômetro.
 * Cada registro é uma linha própria, então dá para corrigir apagando.
 */
export function RegistroDesafio({
  desafioId,
  alunoId,
  metrica,
  hoje,
  registros,
  bloqueado,
}: {
  desafioId: string;
  alunoId: string;
  metrica: Metrica;
  hoje: string;
  registros: Registro[];
  /** Desafio encerrado ou fora do período: só leitura. */
  bloqueado: boolean;
}) {
  const router = useRouter();
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState(hoje);
  const [salvando, setSalvando] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciarTransicao] = useTransition();

  async function registrar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const valor = Number(quantidade.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Diga quanto foi, por exemplo 2,5.");
      return;
    }

    setSalvando(true);

    const { error } = await createClient().from("desafio_registros").insert({
      desafio_id: desafioId,
      aluno_id: alunoId,
      data,
      quantidade: valor,
    });

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos registrar agora. Tente de novo.");
      return;
    }

    setQuantidade("");
    iniciarTransicao(() => router.refresh());
  }

  async function apagar(id: string) {
    setApagando(id);
    await createClient().from("desafio_registros").delete().eq("id", id);
    setApagando(null);
    iniciarTransicao(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      {!bloqueado && (
        <form
          onSubmit={registrar}
          className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90"
          noValidate
        >
          <p className="text-[15px] font-semibold text-neutral-950">
            Quanto você fez hoje?
          </p>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="rd-quantidade" className="text-neutral-700">
                {METRICAS[metrica].titulo}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="rd-quantidade"
                  inputMode="decimal"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value.replace(/[^\d,.]/g, ""))}
                  placeholder="2,5"
                  disabled={salvando}
                  className="numero h-12 w-28 rounded-[14px] px-4 text-center text-base"
                />
                <span className="text-sm text-neutral-500">{METRICAS[metrica].unidade}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="rd-data" className="text-neutral-700">
                Quando
              </Label>
              <Input
                id="rd-data"
                type="date"
                max={hoje}
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={salvando}
                className="h-12 rounded-[14px] px-4 text-base"
              />
            </div>

            <Button
              type="submit"
              disabled={salvando}
              className="h-12 rounded-full px-6 text-base font-semibold"
            >
              {salvando ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Plus className="size-5" aria-hidden />
              )}
              Registrar
            </Button>
          </div>

          {erro && (
            <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {erro}
            </p>
          )}
        </form>
      )}

      {registros.length > 0 && (
        <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
          {registros.map((registro) => (
            <li key={registro.id} className="flex items-center gap-3 px-5 py-3">
              <p className="numero w-24 shrink-0 text-[15px] font-semibold text-neutral-950">
                {formatarQuantidade(registro.quantidade, metrica)}
              </p>
              <p className="rotulo min-w-0 flex-1 text-neutral-400">
                {format(new Date(`${registro.data}T12:00:00Z`), "d 'de' MMM", { locale: ptBR })}
              </p>
              {!bloqueado && (
                <button
                  type="button"
                  onClick={() => apagar(registro.id)}
                  disabled={apagando === registro.id}
                  aria-label="Apagar registro"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-saude-vermelho-light hover:text-saude-vermelho"
                >
                  {apagando === registro.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
