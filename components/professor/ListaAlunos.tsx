"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { CardAluno } from "@/components/professor/CardAluno";
import { Input } from "@/components/ui/input";
import type { AlunoNoPainel } from "@/lib/supabase/painel-professor";
import type { SemaforoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filtro = "todos" | SemaforoStatus | "presentes" | "sumidos";

const FILTROS: { valor: Filtro; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "vermelho", label: "Críticos" },
  { valor: "amarelo", label: "Atenção" },
  { valor: "presentes", label: "Na academia" },
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
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <Input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar aluno pelo nome"
          aria-label="Buscar aluno"
          className="h-12 rounded-xl pl-10 text-base"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTROS.map(({ valor, label }) => {
          const quantidade = contar(valor);
          const ativo = filtro === valor;

          return (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              aria-pressed={ativo}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors",
                ativo
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {label}
              <span className="text-xs text-neutral-400 tabular-nums">
                {quantidade}
              </span>
            </button>
          );
        })}
      </div>

      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
            <Users className="size-5" aria-hidden />
          </span>
          <p className="text-sm text-neutral-500">
            Nenhum aluno com esse critério.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((aluno) => (
            <li key={aluno.perfil.id}>
              <CardAluno aluno={aluno} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
