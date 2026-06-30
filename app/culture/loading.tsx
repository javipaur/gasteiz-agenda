function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-stone animate-pulse">
      <div className="aspect-[4/3] bg-stone" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-16 bg-stone rounded" />
        <div className="h-4 w-full bg-stone rounded" />
        <div className="h-4 w-3/4 bg-stone rounded" />
        <div className="h-3 w-24 bg-stone rounded" />
      </div>
    </div>
  );
}

export default function CultureLoading() {
  return (
    <div className="px-6 max-w-7xl mx-auto pt-24 pb-32">
      <header className="mb-12">
        <div className="h-4 w-20 bg-stone rounded mb-3" />
        <div className="h-10 w-64 bg-stone rounded mb-3" />
        <div className="h-5 w-96 bg-stone rounded" />
      </header>

      <div className="flex gap-3 mb-10">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-24 bg-stone rounded-full" />
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
