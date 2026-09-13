"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { CHIP_SEMAFORO } from "@/components/aluno/CardIndicador";
import { FaixaSemaforo } from "@/components/shared/FaixaSemaforo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { alturaEmMetros, lerNumero } from "@/lib/utils/indicadores";
import { hojeISO } from "@/lib/utils/datas";
import { calcularSemaforo, SEMAFORO_CONFIG } from "@/lib/utils/semaforo";

const CAMPOS = [
  { id: "peso", rotulo: "Peso", unidade: "kg", exemplo: "72,5" },
  { id: "altura", rotulo: "Altura", unidade: "m ou cm", exemplo: "1,75" },
  {
    id: "percentual_gordura",
    rotulo: "% de gordura",
    unidade: "%",
    exemplo: "24",
  },
  {
    id: "massa_muscular",
    rotulo: "Massa muscular",
    unidade: "kg",
    exemplo: "32",
  },
  {
    id: "circunferencia_cintura",
    rotulo: "Cintura",
    unidade: "cm",
    exemplo: "88",
  },
  {
    id: "circunferencia_quadril",
    rotulo: "Quadril",
    unidade: "cm",
    exemplo: "102",
  },
] as const;

type CampoId = (typeof CAMPOS)[number]["id"];

const CARD = "flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6";
const TITULO_CARD = "text-lg font-semibold tracking-[-0.02em] text-neutral-950";
const TEXTAREA =
  "w-full resize-none rounded-[14px] border border-input bg-card px-3.5 py-3 text-base transition-colors outline-none placeholder:text-neutral-400 hover:border-neutral-300 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

interface FormularioAvaliacaoProps {
  professorId: string;
  alunoId: string;
  alunoNome: string;
}

export function FormularioAvaliacao({
  professorId,
  alunoId,
  alunoNome,
}: FormularioAvaliacaoProps) {
  const router = useRouter();

  const [data, setData] = useState(hojeISO());
  const [valores, setValores] = useState<Record<CampoId, string>>({
    peso: "",
    altura: "",
    percentual_gordura: "",
    massa_muscular: "",
    circunferencia_cintura: "",
    circunferencia_quadril: "",
  });
  const [testeForca, setTesteForca] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const peso = lerNumero(valores.peso);
  const metros = alturaEmMetros(lerNumero(valores.altura));
  // Prévia ao vivo: o professor confere o IMC antes de gravar.
  const imc = peso && metros ? peso / (metros * metros) : null;
  const statusImc = imc ? calcularSemaforo("peso", imc) : null;

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    const preenchidos = Object.values(valores).some((v) => v.trim());
    if (!preenchidos && !testeForca.trim()) {
      setErro("Preencha ao menos uma medida.");
      return;
    }

    setSalvando(true);

    const numerico = (id: CampoId) => lerNumero(valores[id]);

    const { error } = await createClient().from("avaliacoes_fisicas").insert({
      aluno_id: alunoId,
      professor_id: professorId,
      data,
      peso: numerico("peso"),
      // Grava sempre em metros, para o IMC não depender de quem digitou.
      altura: metros,
      imc: imc ? Number(imc.toFixed(1)) : null,
      percentual_gordura: numerico("percentual_gordura"),
      massa_muscular: numerico("massa_muscular"),
      circunferencia_cintura: numerico("circunferencia_cintura"),
      circunferencia_quadril: numerico("circunferencia_quadril"),
      teste_forca: testeForca.trim() || null,
      observacoes: observacoes.trim() || null,
    });

    setSalvando(false);

    if (error) {
      setErro("Não conseguimos salvar a avaliação. Confira a conexão e tente de novo.");
      return;
    }

    router.push(`/alunos/${alunoId}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={salvar}
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6"
      noValidate
    >
      <div className="flex flex-col gap-5">
        {/* ── Medidas ──────────────────────────────────────────────── */}
        <section className={CARD}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className={TITULO_CARD}>Medidas</h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                Só o que foi medido hoje em {alunoNome.split(" ")[0]}.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-44">
              <Label htmlFor="av-data" className="text-neutral-700">
                Data
              </Label>
              <Input
                id="av-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={salvando}
                className="h-12 px-3.5 text-base"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3">
            {CAMPOS.map(({ id, rotulo, unidade, exemplo }) => (
              <div key={id} className="flex flex-col gap-2">
                <Label htmlFor={`av-${id}`} className="text-neutral-700">
                  {rotulo}
                </Label>
                <div className="relative">
                  <Input
                    id={`av-${id}`}
                    inputMode="decimal"
                    value={valores[id]}
                    onChange={(e) =>
                      setValores((atuais) => ({ ...atuais, [id]: e.target.value }))
                    }
                    placeholder={exemplo}
                    disabled={salvando}
                    className="numero h-12 pr-16 pl-3.5 text-base"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-medium text-neutral-400">
                    {unidade}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Observações ──────────────────────────────────────────── */}
        <section className={CARD}>
          <h2 className={TITULO_CARD}>Teste e observações</h2>

          <div className="flex flex-col gap-2">
            <Label htmlFor="av-forca" className="text-neutral-700">
              Teste de força{" "}
              <span className="font-normal text-neutral-400">(opcional)</span>
            </Label>
            <Input
              id="av-forca"
              value={testeForca}
              onChange={(e) => setTesteForca(e.target.value)}
              placeholder="Sentar e levantar: 12 repetições em 30s"
              disabled={salvando}
              className="h-12 px-3.5 text-base"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="av-obs" className="text-neutral-700">
              Observações
            </Label>
            <textarea
              id="av-obs"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="O que mudou desde a última avaliação e o que ajustar no treino."
              disabled={salvando}
              className={TEXTAREA}
            />
          </div>
        </section>
      </div>

      {/* ── IMC ao vivo + salvar ───────────────────────────────────── */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-40">
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90 md:p-6">
          <div className="flex items-center justify-between gap-2">
            <p className="rotulo text-neutral-400">IMC calculado</p>
            {statusImc && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  CHIP_SEMAFORO[statusImc]
                )}
              >
                {SEMAFORO_CONFIG[statusImc].label}
              </span>
            )}
          </div>

          {imc ? (
            <>
              <p className="numero text-[44px] leading-none font-semibold text-neutral-950" aria-live="polite">
                {imc.toFixed(1).replace(".", ",")}
                <span className="ml-1.5 font-sans text-sm font-medium tracking-normal text-neutral-400">
                  kg/m²
                </span>
              </p>
              <FaixaSemaforo tipo="peso" valor={imc} className="mt-2" />
              <div aria-hidden className="flex justify-between">
                <span className="rotulo text-neutral-400">16</span>
                <span className="rotulo text-neutral-400">25</span>
                <span className="rotulo text-neutral-400">30</span>
                <span className="rotulo text-neutral-400">40</span>
              </div>
            </>
          ) : (
            <p className="text-[15px] leading-relaxed text-neutral-400">
              Preencha peso e altura para ver o IMC aqui, antes de gravar.
            </p>
          )}
        </div>

        {erro && (
          <p role="alert" className="flex items-start gap-2 text-sm text-saude-vermelho">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {erro}
          </p>
        )}

        <Button
          type="submit"
          disabled={salvando}
          className="h-12 w-full rounded-full text-base font-semibold"
        >
          {salvando ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Salvando...
            </>
          ) : (
            "Lançar avaliação"
          )}
        </Button>
      </aside>
    </form>
  );
}
