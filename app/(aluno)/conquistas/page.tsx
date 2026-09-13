import { redirect } from "next/navigation";
import { Flame, Trophy } from "lucide-react";

import { getConquistasAluno } from "@/lib/supabase/conquistas";
import { META_PADRAO_ML } from "@/lib/supabase/hidratacao";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { cn } from "@/lib/utils";

export default async function ConquistasPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  const { conquistas, totalConquistadas, sequenciaAtual } =
    await getConquistasAluno(
      perfil.id,
      perfil.meta_agua_ml && perfil.meta_agua_ml > 0
        ? perfil.meta_agua_ml
        : META_PADRAO_ML
    );

  const conquistadas = conquistas.filter((c) => c.conquistada);
  const emAndamento = conquistas
    .filter((c) => !c.conquistada)
    .sort((a, b) => b.progresso - a.progresso);

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Conquistas</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          {totalConquistadas === 0
            ? "Nenhuma ainda — a primeira vem no seu primeiro registro."
            : `${totalConquistadas} de ${conquistas.length} conquistadas.`}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        {sequenciaAtual > 0 && (
          <div className="-mt-14 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 md:mt-0">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600">
              <Flame className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-base font-bold text-neutral-900">
                {sequenciaAtual}{" "}
                {sequenciaAtual === 1 ? "dia seguido" : "dias seguidos"}
              </p>
              <p className="text-sm text-neutral-600">
                Sua sequência de presença na academia.
              </p>
            </div>
          </div>
        )}

        {conquistadas.length > 0 && (
          <section
            className={cn(
              "flex flex-col gap-3",
              sequenciaAtual === 0 && "-mt-14 md:mt-0"
            )}
          >
            <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
              Conquistadas
            </h2>

            <ul className="grid gap-3 sm:grid-cols-2">
              {conquistadas.map((conquista) => (
                <li
                  key={conquista.chave}
                  className="flex items-start gap-3 rounded-xl border border-saude-verde/40 bg-saude-verde-light/30 p-4"
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl"
                    aria-hidden
                  >
                    {conquista.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-neutral-900">
                      {conquista.titulo}
                      {conquista.nova && (
                        <span className="rounded-md bg-saude-verde px-1.5 py-0.5 text-xs font-semibold text-white">
                          Novo
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-600">
                      {conquista.descricao}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          className={cn(
            "flex flex-col gap-3",
            sequenciaAtual === 0 && conquistadas.length === 0 && "-mt-14 md:mt-0"
          )}
        >
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            A caminho
          </h2>

          {emAndamento.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-saude-verde-light text-saude-verde">
                <Trophy className="size-5" aria-hidden />
              </span>
              <p className="text-base font-semibold text-neutral-900">
                Você conquistou todas
              </p>
              <p className="max-w-xs text-sm text-neutral-500">
                Isso é constância de verdade. Seu professor está vendo.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {emAndamento.map((conquista) => (
                <li
                  key={conquista.chave}
                  className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-2xl opacity-40 grayscale"
                    aria-hidden
                  >
                    {conquista.emoji}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-neutral-900">
                      {conquista.titulo}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {conquista.descricao}
                    </p>

                    <div className="mt-2 flex items-center gap-3">
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${conquista.progresso}%` }}
                        />
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
                        {conquista.detalhe}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
