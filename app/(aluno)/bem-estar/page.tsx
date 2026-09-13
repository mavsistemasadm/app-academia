import Link from "next/link";
import { redirect } from "next/navigation";
import { Headphones, MessageSquare } from "lucide-react";

import { GuiaAterramento } from "@/components/aluno/GuiaAterramento";
import { GuiaRespiracao } from "@/components/aluno/GuiaRespiracao";
import { getPerfilAtual } from "@/lib/supabase/perfil";
import { AUDIOS } from "@/lib/utils/bem-estar";

export default async function BemEstarPage() {
  const perfil = await getPerfilAtual();
  if (!perfil) redirect("/login");

  return (
    <div className="flex flex-col gap-6 md:gap-8 md:px-8 md:py-8">
      <header className="rounded-b-3xl bg-primary px-5 pt-6 pb-10 text-white md:rounded-2xl md:px-8 md:py-7">
        <h1 className="text-3xl font-bold tracking-tight">Bem-estar</h1>
        <p className="mt-2 max-w-xl text-base text-white/90">
          Respirar devagar baixa a frequência cardíaca em poucos minutos. Use
          quando precisar.
        </p>
      </header>

      <div className="flex flex-col gap-6 px-5 md:gap-8 md:px-0">
        <section className="-mt-14 flex flex-col gap-3 md:mt-0">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase max-md:sr-only">
            Respiração guiada
          </h2>
          <GuiaRespiracao />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Para momentos de ansiedade
          </h2>
          <GuiaAterramento />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
            Meditações do centro
          </h2>

          {AUDIOS.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed border-neutral-300 bg-white p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-400">
                <Headphones className="size-5" aria-hidden />
              </span>
              <p className="text-sm text-neutral-500">
                As meditações gravadas com a voz dos sócios ainda não foram
                publicadas. Assim que os áudios entrarem, aparecem aqui.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {AUDIOS.map((audio) => (
                <li
                  key={audio.chave}
                  className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4"
                >
                  <div>
                    <p className="text-base font-bold text-neutral-900">
                      {audio.titulo}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {audio.descricao} · na voz de {audio.voz} ·{" "}
                      {Math.round(audio.duracaoSegundos / 60)} min
                    </p>
                  </div>
                  <audio
                    src={audio.url}
                    controls
                    preload="none"
                    className="w-full"
                  >
                    Seu navegador não reproduz áudio.
                  </audio>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Link
          href="/chat"
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-sm"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
            <MessageSquare className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900">
              Precisa falar com alguém?
            </p>
            <p className="text-sm text-neutral-500">
              Manda uma mensagem para o seu professor. Ele lê.
            </p>
          </div>
        </Link>

        <p className="text-xs text-neutral-500">
          Estes exercícios acompanham o cuidado do centro — não substituem
          atendimento psicológico ou médico. Em emergência, procure ajuda ou
          ligue 188 (CVV).
        </p>
      </div>
    </div>
  );
}
