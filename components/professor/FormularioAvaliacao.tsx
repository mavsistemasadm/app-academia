"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { alturaEmMetros, lerNumero } from "@/lib/utils/indicadores";
import { hojeISO } from "@/lib/utils/datas";

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
      setErro("Não conseguimos salvar a avaliação.");
      return;
    }

    router.push(`/alunos/${alunoId}`);
    router.refresh();
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5" noValidate>
      <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900">
            Avaliação de {alunoNome}
          </h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            A altura lançada aqui é o que transforma o peso do aluno em IMC.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="av-data" className="text-neutral-700">
            Data
          </Label>
          <Input
            id="av-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={salvando}
            className="h-12 rounded-xl px-3.5 text-base"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CAMPOS.map(({ id, rotulo, unidade, exemplo }) => (
            <div key={id} className="flex flex-col gap-2">
              <Label htmlFor={`av-${id}`} className="text-neutral-700">
                {rotulo}{" "}
                <span className="font-normal text-neutral-400">({unidade})</span>
              </Label>
              <Input
                id={`av-${id}`}
                inputMode="decimal"
                value={valores[id]}
                onChange={(e) =>
                  setValores((atuais) => ({ ...atuais, [id]: e.target.value }))
                }
                placeholder={exemplo}
                disabled={salvando}
                className="h-12 rounded-xl px-3.5 text-base tabular-nums"
              />
            </div>
          ))}
        </div>

        {imc && (
          <p className="rounded-xl bg-neutral-50 px-3.5 py-3 text-sm text-neutral-700">
            IMC calculado:{" "}
            <span className="font-semibold tabular-nums">
              {imc.toFixed(1).replace(".", ",")}
            </span>
          </p>
        )}

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
            className="h-12 rounded-xl px-3.5 text-base"
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
            className="w-full resize-none rounded-xl border border-input bg-transparent px-3.5 py-3 text-base outline-none placeholder:text-neutral-400 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
          />
        </div>
      </section>

      {erro && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-saude-vermelho-light px-3.5 py-3 text-sm text-saude-vermelho"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      <Button
        type="submit"
        disabled={salvando}
        className="h-12 w-full rounded-xl text-base font-semibold"
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
    </form>
  );
}
