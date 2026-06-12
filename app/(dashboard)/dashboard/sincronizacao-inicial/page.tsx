import { redirect } from "next/navigation";

// Esta página existia para o fluxo de sync MaxData que foi removido.
// Redireciona para o dashboard.
export default function SincronizacaoInicialPage() {
  redirect("/dashboard");
}
