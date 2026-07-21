import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { AdminCard } from "@/components/admin/AdminCard";

/** Card com scroll horizontal + <table> — moldura padrão de toda tabela do admin. */
export function AdminTable({ children }: { children: ReactNode }) {
  return (
    <AdminCard className="overflow-x-auto p-0">
      <table className="w-full text-sm">{children}</table>
    </AdminCard>
  );
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr style={{ borderBottom: "1px solid var(--adm-line)" }}>{children}</tr>
    </thead>
  );
}

export function AdminTh({
  children,
  align = "left",
  className = "",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
      style={{ color: "var(--adm-text-faint)" }}
      {...rest}
    >
      {children}
    </th>
  );
}

export function AdminTBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

/** Linha com hover suave e divisor superior — usar `noBorder` na primeira linha. */
export function AdminTr({
  children,
  noBorder = false,
  className = "",
  style,
}: {
  children: ReactNode;
  noBorder?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <tr
      className={`adm-row group ${className}`}
      style={{ borderTop: noBorder ? "none" : "1px solid var(--adm-line)", ...style }}
    >
      {children}
    </tr>
  );
}

export function AdminTd({
  children,
  align = "left",
  className = "",
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={`px-5 text-sm ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
      style={{ paddingTop: "var(--adm-row-py)", paddingBottom: "var(--adm-row-py)", color: "var(--adm-text)" }}
      {...rest}
    >
      {children}
    </td>
  );
}
