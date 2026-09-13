"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { CardAluno } from "@/components/professor/CardAluno";
import { Input } from "@/components/ui/input";
import type { AlunoNoPainel } from "@/lib/supabase/painel-professor";
import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filtro = "todos" | SemaforoStatus | "presentes" | "sumidos";

const FILTROS: { valor: Filtro; label: string; ponto?: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "vermelho", label: "Críticos", ponto: "bg-saude-vermelho" },
  { valor: "amarelo", label: "Atenção", ponto: "bg-saude-amarelo" },
  { valor: "presentes", label: "Na academia", ponto: "bg-ciano" },
  { valor: "sumidos", label: "Sumidos" },
];

/** Ignora acento e caixa — "jose" acha "José". */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function ListaAlunos({ alunos }: { alunos: AlunoNoPainel[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());

    return alunos.filter((aluno) => {
      if (termo && !normalizar(aluno.perfil.nome).includes(termo)) return false;

      switch (filtro) {
        case "vermelho":
        case "amarelo":
          return aluno.status === filtro;
        case "presentes":
          return aluno.presenteAgora;
        case "sumidos":
          return (
            aluno.diasSemAparecer === null || aluno.diasSemAparecer >= 5
          );
        default:
          return true;
      }
    });
  }, [alunos, busca, filtro]);

  const contar = (valor: Filtro) =>
    valor === "todos"
      ? alunos.length
      : alunos.filter((a) =>
          valor === "presentes"
            ? a.presenteAgora
            : valor === "sumidos"
              ? a.diasSemAparecer === null || a.diasSemAparecer >= 5
              : a.status === valor
        ).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative lg:w-80">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-neutral-400"
            strokeWidth={1.9}
            aria-hidden
          />
          <Input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar aluno pelo nome"
            aria-label="Buscar aluno"
            className="h-11 rounded-full pr-4 pl-10 text-base"
          />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {FILTROS.map(({ valor, label, ponto }) => {
            const quantidade = contar(valor);
            const ativo = filtro === valor;

            return (
              <button
                key={valor}
                type="button"
                onClick={() => setFiltro(valor)}
                aria-pressed={ativo}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-all duration-200 active:scale-[.98]",
                  ativo
                    ? "bg-grafite text-white"
                    : "bg-card text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50 hover:text-neutral-950"
                )}
              >
                {ponto && (
                  <span aria-hidden className={cn("size-2 rounded-full", ponto)} />
                )}
                {label}
                <span
                  className={cn(
                    "numero text-[13px] font-semibold",
                    ativo ? "text-white/60" : "text-neutral-400"
                  )}
                >
                  {quantidade}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-card px-6 py-12 text-center ring-1 ring-neutral-200/90">
          <Users className="size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <p className="text-[15px] font-semibold text-neutral-950">
            Ninguém com esse critério
          </p>
          <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
            {busca.trim()
              ? `Nenhum nome parecido com "${busca.trim()}" neste filtro.`
              : "Bom sinal quando o filtro é de críticos ou sumidos."}
          </p>
          {(busca.trim() || filtro !== "todos") && (
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setFiltro("todos");
              }}
              className="mt-1 text-sm font-semibold text-primary"
            >
              Ver todos os alunos
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="rotulo text-neutral-400" aria-live="polite">
            {visiveis.length} {visiveis.length === 1 ? "aluno" : "alunos"}
          </p>
          {/*
            Um card só: no celular as linhas empilham; do desktop para cima,
            duas colunas. O `gap-px` sobre fundo cinza desenha as divisórias.
          */}
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-neutral-200/80 ring-1 ring-neutral-200/90 xl:grid-cols-2">
            {visiveis.map((aluno) => (
              <li key={aluno.perfil.id} className="bg-card">
                <CardAluno aluno={aluno} />
              </li>
            ))}
            {visiveis.length % 2 === 1 && (
              <li aria-hidden className="hidden bg-card xl:block" />
            )}
          </ul>
        </>
      )}
    </div>
  );
}
