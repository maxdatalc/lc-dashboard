import { BridgeMonitorClient } from "@/components/admin/BridgeMonitorClient";

export const dynamic = "force-dynamic";

export default function AdminBridgesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Monitor de Bridges</h1>
        <p className="text-slate-500 text-sm mt-1">
          Status em tempo real das bridges SQL instaladas nos clientes · atualiza a cada 30s
        </p>
      </div>
      <BridgeMonitorClient />
    </div>
  );
}
