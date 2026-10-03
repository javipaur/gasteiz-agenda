/**
 * El contenedor de los esqueletos de carga.
 *
 * Los siete `loading.tsx` del repo eran cajas con `animate-pulse` y nada más, así
 * que cambiar de ruta era un silencio para quien usa lector de pantalla: no había
 * `role="status"`, ni `aria-busy`, ni una palabra que anunciar. Este componente lo
 * resuelve en un sitio, y es un sitio y no siete porque `app/culture/loading.tsx` y
 * `app/deporte/loading.tsx` son copia el uno del otro: cualquier arreglo aplicado a
 * uno y no al otro deja el mismo fallo duplicado y sin que nadie lo note.
 *
 * El texto va en `sr-only` porque los esqueletos son cajas vacías: no tienen texto
 * visible que pueda anunciarse.
 */
export default function LoadingStatus({
  children,
  label = "Cargando contenido…",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    // `aria-busy="true"` le dice al lector que espere antes de recoger lo que hay
    // debajo: sin él, el esqueleto y el contenido real compiten por el anuncio.
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}