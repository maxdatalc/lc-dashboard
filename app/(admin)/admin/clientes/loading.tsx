export default function Loading() {
  return (
    <div className="p-6 animate-pulse space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="h-6 w-44 rounded-lg bg-slate-200" />
          <div className="h-3.5 w-64 rounded mt-2 bg-slate-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-200" />
      </div>
      <div className="flex gap-3">
        <div className="h-9 flex-1 rounded-lg bg-slate-100" />
        <div className="h-9 w-48 rounded-lg bg-slate-100" />
        <div className="h-9 w-40 rounded-lg bg-slate-100" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="h-10 bg-slate-50 border-b border-slate-100" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-slate-50">
            <div className="h-3 w-12 rounded bg-slate-100" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-48 rounded bg-slate-100" />
              <div className="h-2.5 w-32 rounded bg-slate-50" />
            </div>
            <div className="h-5 w-28 rounded-full bg-slate-100" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
