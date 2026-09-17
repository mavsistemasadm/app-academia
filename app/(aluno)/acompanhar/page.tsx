import Link from "next/link";
import { redirect } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AceitarConvite } from "@/components/aluno/AceitarConvite";
import { CardIndicador } from "@/components/aluno/CardIndicador";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { cn } from "@/lib/utils";
import { getVisaoFamiliar } from "@/lib/supabase/familiares";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { hojeISO, somarDiasISO } from "@/lib/utils/datas";
import { CONFIG_INDICADORES } from "@/lib/utils/indicadores";

const DIAS_NO_CALENDARIO = 30;

export default async function AcompanharPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const acompanhados = await getVisaoFamiliar(perfil.id);
  const hoje = hojeISO();

  const janela = Array.from({ length: DIAS_NO_CALENDARIO }, (_, i) =>
    somarDiasISO(hoje, -(DIAS_NO_CALENDARIO - 1 - i))
  );

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Família"
        titulo={perfil.role === "familiar" ? "Quem você acompanha" : "Acompanhar um familiar"}
        descricao={
          acompanhados.length === 0
            ? "Recebeu um código de um familiar que treina no centro? Digite aqui e acompanhe a saúde dele."
            : "Indicadores e frequência de quem você acompanha."
        }
      />

      <div className="flex flex-col gap-9 px-5 md:gap-12 md:px-0">
        {acompanhados.length === 0 && (
          <div className="w-full max-w-xl">
            <AceitarConvite familiarId={perfil.id} codigoInicial={codigo} />
          </div>
        )}

        {acompanhados.map((pessoa) => {
          const presentes = new Set(pessoa.diasPresentes);

          return (
            <section key={pessoa.aluno.id} className="flex flex-col gap-4">
              {/* ── Quem ───────────────────────────────────────── */}
              <div className="flex items-center gap-3.5">
                <span className="numero flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-grafite text-xl font-semibold text-white">
                  {pessoa.aluno.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pessoa.aluno.foto_url}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    pessoa.aluno.nome.charAt(0).toUpperCase() || "?"
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
                    {pessoa.aluno.nome}
                  </h2>
                  <p className="text-sm text-neutral-500">
                    {pessoa.parentesco ?? "Familiar"} ·{" "}
                    {pessoa.ultimaPresenca
                      ? `esteve na academia ${formatDistanceToNow(
                          new Date(`${pessoa.ultimaPresenca}T12:00:00Z`),
                          { addSuffix: true, locale: ptBR }
                        )}`
                      : "sem presença registrada"}
                  </p>
                </div>
              </div>

              {/* ── Indicadores ────────────────────────────────── */}
              {pessoa.indicadores.length === 0 ? (
                <div className="rounded-2xl bg-card px-5 py-5 ring-1 ring-neutral-200/90">
                  <p className="text-[15px] font-medium text-neutral-950">
                    Ainda sem medição
                  </p>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    Assim que {pessoa.aluno.nome.split(" ")[0]} registrar um
                    indicador, ele aparece aqui.
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                  {pessoa.indicadores.map((registro) => {
                    const config = CONFIG_INDICADORES[registro.tipo];
                    const ehPeso = registro.tipo === "peso";

                    return (
                      <li key={registro.id} className="flex flex-col gap-1.5">
                        <CardIndicador
                          icone={config.icone}
                          valor={
                            ehPeso
                              ? registro.valorFormatado.replace(" kg", "")
                              : registro.valorFormatado
                          }
                          unidade={config.unidade}
                          label={config.labelCurto}
                          status={registro.status}
                          badge={registro.badge || undefined}
                          faixa={
                            ehPeso
                              ? registro.imc
                                ? { tipo: "peso", valor: registro.imc }
                                : undefined
                              : {
                                  tipo: registro.tipo,
                                  valor: registro.valorPrincipal,
                                  valorSecundario: registro.valorSecundario,
                                }
                          }
                        />
                        <p className="px-1 text-[13px] text-neutral-400">
                          {formatDistanceToNow(new Date(registro.registradoEm), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ── Frequência ─────────────────────────────────── */}
              <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 ring-1 ring-neutral-200/90">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                    Frequência
                  </h3>
                  <p className="numero text-[28px] leading-none font-semibold text-neutral-950">
                    {pessoa.frequenciaNoMes}
                    <span className="ml-1 font-sans text-xs font-medium tracking-normal text-neutral-400">
                      {pessoa.frequenciaNoMes === 1 ? "presença" : "presenças"} no mês
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-10 gap-1.5">
                  {janela.map((dia) => {
                    const veio = presentes.has(dia);
                    const rotulo = format(new Date(`${dia}T12:00:00Z`), "dd/MM");

                    return (
                      <div
                        key={dia}
                        title={`${rotulo}: ${veio ? "esteve na academia" : "não veio"}`}
                        className={cn(
                          "aspect-square rounded-[6px]",
                          veio ? "bg-ciano" : "bg-neutral-100"
                        )}
                      >
                        <span className="sr-only">
                          {rotulo}: {veio ? "presente" : "ausente"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="rotulo text-neutral-400">Últimos 30 dias</p>
              </div>
            </section>
          );
        })}

        {acompanhados.length > 0 && (
          <>
            <p className="text-sm text-neutral-500">
              Você vê apenas indicadores e frequência. Treino, humor, conversas e
              anamnese ficam entre o aluno e o centro.
            </p>
            <div className="w-full max-w-xl">
              <AceitarConvite familiarId={perfil.id} codigoInicial={codigo} />
            </div>
          </>
        )}

        {perfil.role !== "familiar" && (
          <p className="text-sm text-neutral-500">
            Quer o contrário, que alguém acompanhe <strong className="font-semibold">você</strong>?{" "}
            <Link
              href="/familiares"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Gere um código em Dar acesso à família →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
