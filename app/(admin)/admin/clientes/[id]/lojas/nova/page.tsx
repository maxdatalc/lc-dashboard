import { redirect } from "next/navigation";
export default async function NovaLojaClienteRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/empresas/${id}/lojas/nova`);
}
