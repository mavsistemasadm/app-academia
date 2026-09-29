"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Marca no user_metadata: vale em qualquer aparelho em que a pessoa entrar. */
export const CHAVE_VIDEO_VISTO = "av-boas-vindas-visto-v1";

/** Avisa o tour guiado de que já pode abrir (ele espera o vídeo fechar). */
export const EVENTO_VIDEO_FECHADO = "av-boas-vindas-fechado";

const VIDEO = "/boas-vindas.mp4";
const CAPA = "/boas-vindas.jpg";

/**
 * Vídeo de boas-vindas do centro. Abre sozinho no primeiro acesso, antes do
 * tour, e grava no usuário que já viu ao fechar ou ao terminar.
 *
 * O navegador só deixa tocar sozinho com som depois de um toque na página.
 * Então tenta com som; se for barrado, toca sem som e mostra "Ativar som".
 */
export function VideoBoasVindas() {
  const [aberto, setAberto] = useState(false);
  const [semSom, setSemSom] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user && !user.user_metadata?.[CHAVE_VIDEO_VISTO]) setAberto(true);
      });
  }, []);

  useEffect(() => {
    if (!aberto || !video.current) return;
    const el = video.current;
    el.muted = false;
    el.play().catch(() => {
      el.muted = true;
      setSemSom(true);
      el.play().catch(() => {
        // Nem sem som: fica parado com os controles à mostra.
      });
    });
  }, [aberto]);

  const fechar = useCallback(async () => {
    video.current?.pause();
    setAberto(false);
    window.dispatchEvent(new Event(EVENTO_VIDEO_FECHADO));
    await createClient().auth.updateUser({ data: { [CHAVE_VIDEO_VISTO]: true } });
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto, fechar]);

  if (!aberto) return null;

  function ativarSom() {
    if (!video.current) return;
    video.current.muted = false;
    setSemSom(false);
    video.current.play().catch(() => {});
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="boas-vindas-titulo"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-grafite/90 p-4 backdrop-blur-sm"
    >
      <div className="relative flex w-full max-w-sm flex-col gap-4 md:max-w-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="rotulo text-white/60">Atitude Vital</p>
            <h2
              id="boas-vindas-titulo"
              className="text-xl font-semibold tracking-[-0.02em] text-white"
            >
              Que bom ter você aqui
            </h2>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar vídeo de boas-vindas"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-[22px] bg-black ring-1 ring-white/10">
          <video
            ref={video}
            src={VIDEO}
            poster={CAPA}
            playsInline
            controls
            preload="auto"
            onEnded={() => setTerminou(true)}
            className="max-h-[70dvh] w-full bg-black object-contain"
          />

          {semSom && !terminou && (
            <button
              type="button"
              onClick={ativarSom}
              className="absolute top-3 left-1/2 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neutral-950 shadow-lg"
            >
              <Volume2 className="size-4" aria-hidden />
              Ativar som
            </button>
          )}
        </div>

        <Button
          type="button"
          onClick={fechar}
          className="h-12 w-full rounded-full text-base font-semibold"
        >
          {terminou ? "Começar" : "Pular e começar"}
        </Button>
      </div>
    </div>
  );
}
