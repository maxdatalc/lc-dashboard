export default function Loading() {
  return (
    <div className="animate-pulse space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="h-6 w-44 rounded-lg" style={{ background: "var(--adm-surface-2)" }} />
          <div className="mt-2 h-3.5 w-64 rounded" style={{ background: "var(--adm-surface-2)" }} />
        </div>
        <div className="h-9 w-36 rounded-lg" style={{ background: "var(--adm-surface-2)" }} />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 rounded-lg" style={{ background: "var(--adm-surface-2)" }} />
        <div className="h-9 w-48 rounded-lg" style={{ background: "var(--adm-surface-2)" }} />
        <div className="h-9 w-40 rounded-lg" style={{ background: "var(--adm-surface-2)" }} />
      </div>
      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--adm-line)", background: "var(--adm-surface)" }}>
        <div className="h-10" style={{ background: "var(--adm-surface-2)", borderBottom: "1px solid var(--adm-line)" }} />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: "1px solid var(--adm-line)" }}>
            <div className="h-3 w-12 rounded" style={{ background: "var(--adm-surface-2)" }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-48 rounded" style={{ background: "var(--adm-surface-2)" }} />
              <div className="h-2.5 w-32 rounded" style={{ background: "var(--adm-surface-2)" }} />
            </div>
            <div className="h-5 w-28 rounded-full" style={{ background: "var(--adm-surface-2)" }} />
            <div className="h-3 w-20 rounded" style={{ background: "var(--adm-surface-2)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
