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
import {
  avisosDobras,
  calcularDobras,
  DOBRAS,
  idadeNaData,
  type DobraId,
  type Sexo,
} from "@/lib/utils/dobras";
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

const DOBRAS_VAZIAS = Object.fromEntries(DOBRAS.map(({ id }) => [id, ""])) as Record<
  DobraId,
  string
>;

function numeroBR(valor: number, casas = 1) {
  return valor.toFixed(casas).replace(".", ",");
}

interface FormularioAvaliacaoProps {
  professorId: string;
  alunoId: string;
  alunoNome: string;
  /** `YYYY-MM-DD` do cadastro, para sugerir a idade das dobras. */
  nascimento?: string | null;
  /** Sexo lançado na última avaliação com dobras, se houver. */
  sexoAnterior?: Sexo | null;
}

export function FormularioAvaliacao({
  professorId,
  alunoId,
  alunoNome,
  nascimento = null,
  sexoAnterior = null,
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

  // ── Dobras cutâneas (opcional) ──────────────────────────────────
  const [comDobras, setComDobras] = useState(false);
  const [sexo, setSexo] = useState<Sexo | null>(sexoAnterior);
  // null = segue a idade calculada pelo nascimento; texto = o professor corrigiu.
  const [idadeDigitada, setIdadeDigitada] = useState<string | null>(null);
  const [dobras, setDobras] = useState<Record<DobraId, string>>(DOBRAS_VAZIAS);

  const idadeCadastro = nascimento && data ? idadeNaData(nascimento, data) : null;
  const idadeTexto = idadeDigitada ?? (idadeCadastro !== null ? String(idadeCadastro) : "");
  const idadeLida = lerNumero(idadeTexto);
  const idade =
    idadeLida !== null && Number.isInteger(idadeLida) && idadeLida > 0 ? idadeLida : null;

  const dobrasLidas = Object.fromEntries(
    DOBRAS.map(({ id }) => {
      const n = lerNumero(dobras[id]);
      return [id, n !== null && n > 0 ? n : null];
    })
  ) as Record<DobraId, number | null>;
  const todasAsDobras = DOBRAS.every(({ id }) => dobrasLidas[id] !== null);

  const resultado =
    comDobras && todasAsDobras && idade !== null && sexo
      ? calcularDobras(
          DOBRAS.map(({ id }) => dobrasLidas[id] as number),
          idade,
          sexo,
          peso
        )
      : null;
  const avisos = comDobras
    ? avisosDobras({ valores: dobrasLidas, idade, sexo, peso, resultado })
    : [];
  // Com as dobras completas, o % de gordura vem do cálculo e o campo trava.
  const gorduraCalculada = resultado ? Number(resultado.percentualGordura.toFixed(1)) : null;

  async function salvar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    if (!data) {
      setErro("Informe a data da avaliação.");
      return;
    }

    // Campo preenchido com algo que não é número positivo sumiria calado.
    const invalido = CAMPOS.find((c) => {
      if (c.id === "percentual_gordura" && gorduraCalculada !== null) return false;
      const texto = valores[c.id as CampoId].trim();
      if (!texto) return false;
      const n = lerNumero(texto);
      return n === null || !Number.isFinite(n) || n <= 0;
    });
    if (invalido) {
      setErro(`${invalido.rotulo}: use só o número, por exemplo ${invalido.exemplo}.`);
      return;
    }

    if (comDobras) {
      const invalida = DOBRAS.find(({ id }) => dobras[id].trim() && dobrasLidas[id] === null);
      if (invalida) {
        setErro(`Dobra ${invalida.rotulo.toLowerCase()}: use só o número em mm, por exemplo 12,5.`);
        return;
      }
      if (!resultado) {
        setErro(
          "Para calcular pelas dobras, preencha sexo, idade e as 7 dobras. Ou desligue a seção Dobras cutâneas."
        );
        return;
      }
    }

    const preenchidos = Object.values(valores).some((v) => v.trim()) || resultado !== null;
    if (!preenchidos && !testeForca.trim()) {
      setErro("Preencha ao menos uma medida.");
      return;
    }

    setSalvando(true);

    const numerico = (id: CampoId) => lerNumero(valores[id]);

    // Colunas da migração 020: só entram quando as dobras foram medidas, para
    // a avaliação sem dobras continuar gravando mesmo antes da migração.
    const camposDobras = resultado
      ? {
          protocolo_dobras: "jp7",
          sexo,
          idade,
          ...Object.fromEntries(DOBRAS.map(({ id }) => [id, dobrasLidas[id]])),
          soma_dobras: Number(resultado.soma.toFixed(1)),
          densidade_corporal: Number(resultado.densidade.toFixed(5)),
          massa_gorda:
            resultado.massaGorda !== null ? Number(resultado.massaGorda.toFixed(1)) : null,
          massa_magra:
            resultado.massaMagra !== null ? Number(resultado.massaMagra.toFixed(1)) : null,
        }
      : {};

    const { error } = await createClient().from("avaliacoes_fisicas").insert({
      aluno_id: alunoId,
      professor_id: professorId,
      data,
      peso: numerico("peso"),
      // Grava sempre em metros, para o IMC não depender de quem digitou.
      altura: metros,
      imc: imc ? Number(imc.toFixed(1)) : null,
      percentual_gordura: gorduraCalculada ?? numerico("percentual_gordura"),
      massa_muscular: numerico("massa_muscular"),
      circunferencia_cintura: numerico("circunferencia_cintura"),
      circunferencia_quadril: numerico("circunferencia_quadril"),
      teste_forca: testeForca.trim() || null,
      observacoes: observacoes.trim() || null,
      ...camposDobras,
    });

    if (error) {
      setSalvando(false);
      // PGRST204: coluna que o banco não conhece, ou seja, falta a migração 020.
      setErro(
        resultado && error.code === "PGRST204"
          ? "O banco ainda não está pronto para dobras cutâneas (falta a migração 020). Desligue a seção para salvar só as medidas."
          : "Não conseguimos salvar a avaliação. Confira a conexão e tente de novo."
      );
      return;
    }
    // Sem liberar o botão: a navegação já começou e um segundo toque duplicaria.

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
            {CAMPOS.map(({ id, rotulo, unidade, exemplo }) => {
              const calculado = id === "percentual_gordura" && gorduraCalculada !== null;
              return (
              <div key={id} className="flex flex-col gap-2">
                <Label htmlFor={`av-${id}`} className="text-neutral-700">
                  {rotulo}
                  {calculado && (
                    <span className="font-normal text-neutral-400">(pelas dobras)</span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id={`av-${id}`}
                    inputMode="decimal"
                    value={calculado ? numeroBR(gorduraCalculada ?? 0) : valores[id]}
                    onChange={(e) =>
                      setValores((atuais) => ({ ...atuais, [id]: e.target.value }))
                    }
                    placeholder={exemplo}
                    disabled={salvando}
                    readOnly={calculado}
                    className={cn(
                      "numero h-12 pr-16 pl-3.5 text-base",
                      calculado && "bg-neutral-50 text-neutral-700"
                    )}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-medium text-neutral-400">
                    {unidade}
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        </section>

        {/* ── Dobras cutâneas (opcional) ───────────────────────────── */}
        <section className={CARD}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={TITULO_CARD}>
                Dobras cutâneas{" "}
                <span className="text-sm font-normal tracking-normal text-neutral-400">
                  (opcional)
                </span>
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                Jackson & Pollock, 7 dobras. Calcula o % de gordura sozinho.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setComDobras((atual) => !atual)}
              disabled={salvando}
              aria-expanded={comDobras}
              className="h-10 rounded-full px-4 text-sm font-semibold"
            >
              {comDobras ? "Não medir dobras" : "Medir dobras"}
            </Button>
          </div>

          {comDobras && (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3">
                <fieldset className="col-span-2 flex flex-col gap-2 md:col-span-2">
                  <legend className="mb-2 text-sm font-medium text-neutral-700">Sexo</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["masculino", "Masculino"],
                        ["feminino", "Feminino"],
                      ] as const
                    ).map(([valor, rotulo]) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() => setSexo(valor)}
                        disabled={salvando}
                        aria-pressed={sexo === valor}
                        className={cn(
                          "h-12 rounded-[14px] border text-base font-medium transition-colors",
                          sexo === valor
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-input bg-card text-neutral-700 hover:border-neutral-300"
                        )}
                      >
                        {rotulo}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="col-span-2 flex flex-col gap-2 md:col-span-1">
                  <Label htmlFor="av-idade" className="text-neutral-700">
                    Idade
                    {idadeDigitada === null && idadeCadastro !== null && (
                      <span className="font-normal text-neutral-400">(do cadastro)</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="av-idade"
                      inputMode="numeric"
                      value={idadeTexto}
                      onChange={(e) => setIdadeDigitada(e.target.value)}
                      placeholder="35"
                      disabled={salvando}
                      className="numero h-12 pr-16 pl-3.5 text-base"
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-medium text-neutral-400">
                      anos
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-3">
                {DOBRAS.map(({ id, rotulo }) => (
                  <div key={id} className="flex flex-col gap-2">
                    <Label htmlFor={`av-${id}`} className="text-neutral-700">
                      {rotulo}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`av-${id}`}
                        inputMode="decimal"
                        value={dobras[id]}
                        onChange={(e) =>
                          setDobras((atuais) => ({ ...atuais, [id]: e.target.value }))
                        }
                        placeholder="12"
                        disabled={salvando}
                        className="numero h-12 pr-12 pl-3.5 text-base"
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-xs font-medium text-neutral-400">
                        mm
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {resultado && (
                <dl
                  aria-live="polite"
                  className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-[14px] bg-neutral-50 p-4 md:grid-cols-3"
                >
                  {(
                    [
                      ["Soma das dobras", numeroBR(resultado.soma), "mm"],
                      ["Densidade", numeroBR(resultado.densidade, 4), "g/cm³"],
                      ["% de gordura", numeroBR(resultado.percentualGordura), "%"],
                      [
                        "Massa gorda",
                        resultado.massaGorda !== null ? numeroBR(resultado.massaGorda) : "-",
                        "kg",
                      ],
                      [
                        "Massa magra",
                        resultado.massaMagra !== null ? numeroBR(resultado.massaMagra) : "-",
                        "kg",
                      ],
                    ] as const
                  ).map(([rotulo, valor, unidade]) => (
                    <div key={rotulo} className="flex flex-col gap-1">
                      <dt className="rotulo text-neutral-400">{rotulo}</dt>
                      <dd className="numero text-xl leading-none font-semibold text-neutral-950">
                        {valor}
                        {valor !== "-" && (
                          <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                            {unidade}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {avisos.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {avisos.map((aviso) => (
                    <li
                      key={aviso}
                      className="flex items-start gap-2 text-sm text-saude-amarelo"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {aviso}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
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
