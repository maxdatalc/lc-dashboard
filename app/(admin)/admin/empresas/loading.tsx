// Loading skeleton para a lista de empresas
export default function Loading() {
  return (
    <div className="p-8 animate-pulse">
      <div className="h-8 rounded-lg mb-2 w-48"
        style={{ background: "rgba(255,255,255,0.06)" }} />
      <div className="h-4 rounded mb-8 w-64"
        style={{ background: "rgba(255,255,255,0.04)" }} />

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
        ))}
      </div>

      <div className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-12 px-6 flex items-center gap-4"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 rounded flex-1"
              style={{ background: "rgba(255,255,255,0.08)" }} />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 px-6 flex items-center gap-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="h-3 rounded flex-1"
                style={{ background: "rgba(255,255,255,0.04)" }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
