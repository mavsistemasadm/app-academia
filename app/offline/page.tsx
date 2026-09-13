import { WifiOff } from "lucide-react";

export const metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-background px-6 text-center">
      {/*
        <img> puro de propósito: sem rede, o otimizador do next/image não
        responde. O service worker guarda /marca/logo.png para esta tela.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/marca/logo.png"
        alt="Atitude Vital"
        width={1000}
        height={336}
        className="h-auto w-36"
      />

      <WifiOff
        className="mt-14 size-8 text-neutral-400"
        strokeWidth={1.6}
        aria-hidden
      />
      <p className="rotulo mt-5 text-neutral-400">Sem conexão</p>
      <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em] text-neutral-950">
        Você está sem internet
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-neutral-500">
        Seus dados de saúde precisam de conexão para ficarem certos — por isso
        não guardamos uma cópia velha aqui. Assim que o sinal voltar, é só
        tentar de novo.
      </p>

      <a
        href="/home"
        className="mt-8 flex h-12 items-center justify-center rounded-full bg-grafite px-6 text-[15px] font-semibold text-white transition-all duration-200 hover:bg-neutral-800 active:scale-[.98]"
      >
        Tentar de novo
      </a>
    </main>
  );
}
