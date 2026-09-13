import { HeartPulse } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-md">
        <header className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <HeartPulse className="size-7" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Central de Saúde Conectada
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Seu cuidado acompanhado todos os dias
          </p>
        </header>

        {children}

        <p className="mt-8 text-center text-xs text-neutral-400">
          Seus dados de saúde são privados e protegidos.
        </p>
      </div>
    </div>
  );
}
