import type { ReactNode } from "react";
import { CHART_HEIGHT, type ChartHeightRole } from "@/components/charts/chart-heights";

/**
 * Moldura com altura fluida (clamp) para gráficos Recharts.
 * O ResponsiveContainer interno deve usar width="100%" height="100%" —
 * o tipo do Recharts não aceita string CSS arbitrária em height.
 */
export function ChartFrame({
  role = "default",
  children,
}: {
  role?: ChartHeightRole;
  children: ReactNode;
}) {
  return <div style={{ width: "100%", height: CHART_HEIGHT[role] }}>{children}</div>;
}
