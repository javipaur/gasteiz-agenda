/**
 * `ffprobe-static` no publica tipos y el script solo necesita la ruta al binario.
 * Se declara aquí, junto al script que lo usa, en vez de añadir una dependencia
 * de `@types` para una sola propiedad.
 */
declare module "ffprobe-static" {
  const ffprobe: { path: string };
  export default ffprobe;
}
