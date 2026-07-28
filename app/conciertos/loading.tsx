export default function ConciertosLoading() {
  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <div className="mb-10">
        <div className="h-3 w-16 bg-surface rounded animate-pulse mb-3" />
        <div className="h-12 w-64 bg-surface rounded-xl animate-pulse mb-3" />
        <div className="h-5 w-80 bg-surface rounded-lg animate-pulse" />
      </div>

      <div className="flex gap-2 mb-10">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-24 bg-surface rounded-full animate-pulse" />
        ))}
      </div>

      <div className="mb-12">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-5 w-32 bg-surface rounded animate-pulse" />
          <div className="h-3 w-48 bg-surface rounded animate-pulse" />
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[4/3] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
