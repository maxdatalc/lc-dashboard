"use client";

import { useEffect, useRef, useState } from "react";

type Status = "checking" | "online" | "offline";

interface Props {
  expanded: boolean;
}

export function BridgeHealthBadge({ expanded }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const isMounted = useRef(true);

  const check = async () => {
    try {
      const res = await fetch("/api/bridge/health", { cache: "no-store" });
      if (!isMounted.current) return;
      if (res.ok) {
        const data = await res.json() as { connected: boolean };
        setStatus(data.connected ? "online" : "offline");
      } else {
        setStatus("offline");
      }
    } catch {
      if (isMounted.current) setStatus("offline");
    }
  };

  useEffect(() => {
    isMounted.current = true;
    check();
    const interval = setInterval(check, 30_000);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dotColor =
    status === "online"   ? "#22c55e"
    : status === "offline" ? "#ef4444"
    : "var(--text-muted)";

  const label =
    status === "online"    ? "ERP Conectado"
    : status === "offline" ? "ERP Offline"
    : "Verificando...";

  return (
    <div
      style={{
        height: 32,
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        borderLeft: "3px solid transparent",
      }}
    >
      {/* Dot — alinha com os ícones (container 18×18) */}
      <div
        style={{
          width: 18,
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
        }}
      >
        {status === "online" && (
          <span
            className="animate-ping"
            style={{
              position: "absolute",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: dotColor,
              opacity: 0.4,
            }}
          />
        )}
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: dotColor,
            flexShrink: 0,
            transition: "background 0.4s ease",
          }}
        />
      </div>

      {/* Label — aparece apenas quando expandido */}
      <span
        style={{
          fontSize: 11,
          color: dotColor,
          whiteSpace: "nowrap",
          opacity: expanded ? 0.85 : 0,
          transform: expanded ? "translateX(0)" : "translateX(-6px)",
          transition: "opacity 0.2s ease 0.05s, transform 0.2s ease 0.05s, color 0.4s ease",
        }}
      >
        {label}
      </span>
    </div>
  );
}
