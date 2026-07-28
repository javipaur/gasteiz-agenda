export default function HomeLoading() {
  return (
    <div className="px-5 sm:px-6 pt-28 pb-16 md:pt-36 md:pb-24 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="h-3 w-32 bg-bg-muted rounded animate-pulse" />
      </div>

      <div className="mb-2 flex items-end gap-4 md:gap-6">
        <div className="h-20 md:h-32 w-28 bg-bg-muted rounded-lg animate-pulse" />
        <div className="pb-2 md:pb-4 space-y-2">
          <div className="h-4 w-24 bg-bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="h-10 w-80 bg-bg-muted rounded-lg mb-10 animate-pulse" />

      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-16 h-20 bg-surface border border-border rounded-2xl animate-pulse" />
        ))}
      </div>

      <div className="mt-16">
        <div className="h-8 w-48 bg-bg-muted rounded-lg mb-3 animate-pulse" />
        <div className="h-4 w-64 bg-bg-muted rounded animate-pulse" />
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-[1.25rem] overflow-hidden bg-surface border border-border animate-pulse">
            <div className="aspect-[4/3] bg-bg-muted" />
            <div className="p-4 space-y-3">
              <div className="h-3 w-16 bg-bg-muted rounded" />
              <div className="h-4 w-full bg-bg-muted rounded" />
              <div className="h-4 w-3/4 bg-bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
