/**
 * Cabeçalho das telas internas. Substitui o antigo bloco azul: título em Sora
 * sobre o fundo névoa, um rótulo técnico em cima e, se houver, uma ação à
 * direita. O conteúdo logo abaixo não precisa mais de margem negativa.
 */
export function CabecalhoPagina({
  rotulo,
  titulo,
  descricao,
  acao,
}: {
  rotulo?: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-5 pt-7 md:px-0 md:pt-0">
      <div className="min-w-0">
        {rotulo && <p className="rotulo text-primary">{rotulo}</p>}
        <h1 className="mt-1.5 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-neutral-950 md:text-[34px]">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-neutral-500">
            {descricao}
          </p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </header>
  );
}
