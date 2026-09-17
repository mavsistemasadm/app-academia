import { FormularioContaFamiliar } from "@/components/shared/FormularioContaFamiliar";

export default async function FamiliaPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  return <FormularioContaFamiliar codigoInicial={codigo ?? ""} />;
}
