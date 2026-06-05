import { redirect } from "next/navigation";
export default async function ClienteDetalheRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/empresas/${id}`);
}
