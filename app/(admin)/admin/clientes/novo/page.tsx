import { redirect } from "next/navigation";
export default function NovoClienteRedirect() {
  redirect("/admin/empresas/novo");
}
