import LoadingStatus from "@/app/components/LoadingStatus";

/**
 * El esqueleto de una página de lista.
 *
 * Existe porque el `loading.tsx` de la raíz se retiró, y el motivo no se ve en
 * una captura: un `loading.tsx` ancestro es una **frontera de Suspense**, y una
 * frontera compromete el `200` antes de que la página llegue a llamar a
 * `notFound()`. Por eso `/evento/[slug]` y `/agenda/[mes]` respondían **200 con
 * `noindex`** en vez de 404: el esqueleto se había pintado ya, y el status no se
 * puede cambiar a mitad del stream.
 *
 * Al retirar el de la raíz, las siete rutas de datos que se quedan con esqueleto
 * lo piden aquí, con su etiqueta, en vez de copiar el marcado. Una copia se queda
 * atrás en la siguiente ruta que se añada, y eso ya pasó con `culture` y `deporte`.
 */
export default function SkeletonPagina({ label }: { label: string }) {
  return (
    <LoadingStatus label={label}>
      <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
        <header className="mb-10">
          <div className="h-4 w-20 bg-bg-muted rounded mb-3 animate-pulse" />
          <div className="h-10 w-64 bg-bg-muted rounded mb-3 animate-pulse" />
          <div className="h-5 w-96 bg-bg-muted rounded animate-pulse" />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[1.25rem] overflow-hidden bg-surface border border-border animate-pulse"
            >
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
    </LoadingStatus>
  );
}
