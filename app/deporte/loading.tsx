function SkeletonCard() {
  return (
    <div className="rounded-[1.25rem] overflow-hidden bg-surface border border-border animate-pulse">
      <div className="aspect-[4/3] bg-bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 bg-bg-muted rounded" />
        <div className="h-4 w-full bg-bg-muted rounded" />
        <div className="h-4 w-3/4 bg-bg-muted rounded" />
        <div className="h-3 w-24 bg-bg-muted rounded" />
      </div>
    </div>
  );
}

export default function DeporteLoading() {
  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <header className="mb-12">
        <div className="h-4 w-20 bg-bg-muted rounded mb-3 animate-pulse" />
        <div className="h-10 w-64 bg-bg-muted rounded mb-3 animate-pulse" />
        <div className="h-5 w-96 bg-bg-muted rounded animate-pulse" />
      </header>

      <div className="flex gap-3 mb-10">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-24 bg-bg-muted rounded-full animate-pulse" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
