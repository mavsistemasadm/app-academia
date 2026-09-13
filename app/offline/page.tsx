import { WifiOff } from "lucide-react";

export const metadata = { title: "Sem conexão" };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
        <WifiOff className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-neutral-900">
        Você está sem internet
      </h1>
      <p className="max-w-xs text-sm text-neutral-500">
        Seus dados de saúde precisam de conexão para ficarem certos — por isso
        não guardamos uma cópia velha aqui. Assim que voltar o sinal, é só
        recarregar.
      </p>
    </main>
  );
}
