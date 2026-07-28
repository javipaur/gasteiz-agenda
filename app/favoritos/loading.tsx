export default function FavoritosLoading() {
  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <div className="mb-10">
        <div className="h-12 w-48 bg-surface rounded-xl animate-pulse mb-3" />
        <div className="h-5 w-64 bg-surface rounded-lg animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-[4/3] bg-surface rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
