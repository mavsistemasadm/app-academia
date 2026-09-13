import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Headphones, MessageSquare } from "lucide-react";

import { GuiaAterramento } from "@/components/aluno/GuiaAterramento";
import { GuiaRespiracao } from "@/components/aluno/GuiaRespiracao";
import { CabecalhoPagina } from "@/components/shared/CabecalhoPagina";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { AUDIOS } from "@/lib/utils/bem-estar";

export default async function BemEstarPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  return (
    <div className="flex flex-col gap-7 pt-0 md:gap-9 md:px-8 md:pt-10">
      <CabecalhoPagina
        rotulo="Cuidado"
        titulo="Bem-estar"
        descricao="Respirar devagar baixa a frequência cardíaca em poucos minutos. Use quando precisar."
      />

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Respiração guiada
          </h2>
          <GuiaRespiracao />
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Para momentos de ansiedade
          </h2>
          <GuiaAterramento />
        </section>

        <section className="flex flex-col gap-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-neutral-950 md:text-xl">
            Meditações do centro
          </h2>

          {AUDIOS.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-card px-6 py-9 text-center ring-1 ring-neutral-200/90">
              <span className="relative flex size-14 items-center justify-center">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,180,203,.18),transparent_70%)]"
                />
                <Headphones className="relative size-6 text-neutral-400" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <p className="text-lg font-semibold tracking-[-0.02em] text-neutral-950">
                  Em gravação
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[15px] leading-relaxed text-neutral-500">
                  Os sócios estão gravando meditações com a própria voz. Assim
                  que a primeira faixa ficar pronta, ela aparece aqui.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-neutral-200/80 overflow-hidden rounded-2xl bg-card ring-1 ring-neutral-200/90">
              {AUDIOS.map((audio) => (
                <li key={audio.chave} className="flex flex-col gap-3 p-5">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-neutral-950">
                      {audio.titulo}
                    </p>
                    <p className="mt-0.5 text-sm text-neutral-500">
                      {audio.descricao} · na voz de {audio.voz}
                    </p>
                    <p className="rotulo mt-1.5 text-neutral-400">
                      {Math.round(audio.duracaoSegundos / 60)} min
                    </p>
                  </div>
                  <audio src={audio.url} controls preload="none" className="w-full">
                    Seu navegador não reproduz áudio.
                  </audio>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href="/chat"
          className="group flex items-center gap-3.5 rounded-2xl bg-card px-5 py-4 ring-1 ring-neutral-200/90 transition-all duration-200 hover:shadow-[0_10px_30px_-14px_rgba(12,18,20,.25)]"
        >
          <MessageSquare className="size-5 shrink-0 text-neutral-400" strokeWidth={1.8} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-neutral-950">
              Precisa falar com alguém?
            </p>
            <p className="text-sm text-neutral-500">
              Mande uma mensagem para o seu professor. Ele lê.
            </p>
          </div>
          <ChevronRight
            className="size-4 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>

        <p className="text-[13px] leading-relaxed text-neutral-400">
          Estes exercícios acompanham o cuidado do centro — não substituem
          atendimento psicológico ou médico. Em emergência, procure ajuda ou
          ligue 188 (CVV).
        </p>
      </div>
    </div>
  );
}
