export default function FiestasLoading() {
  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <div className="mb-10">
        <div className="h-3 w-24 bg-surface rounded animate-pulse mb-3" />
        <div className="h-12 w-72 bg-surface rounded-xl animate-pulse mb-3" />
        <div className="h-5 w-56 bg-surface rounded-lg animate-pulse" />
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-28 bg-surface rounded-full animate-pulse" />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="aspect-[4/3] bg-surface rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
