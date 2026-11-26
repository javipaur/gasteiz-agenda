import { AVISO_CAMBIOS, NAVIDAD_2026, PIEZAS_NAVIDAD } from "@/lib/navidad-vitoria";

/**
 * Lo que n8n recoge para preparar el carrusel y el reel. No publica nada: la
 * decisión de si esta campaña sale sigue siendo de una persona, y el token de
 * Instagram no vive en este repositorio.
 *
 * Las claves van cerradas, igual que en el paquete de Moradillos: un consumidor
 * que espere otro nombre debe fallar aquí y no a mitad de una publicación.
 */
export function GET() {
  return Response.json({
    aviso: AVISO_CAMBIOS,
    campana: NAVIDAD_2026.titulo,
    consultado: NAVIDAD_2026.consultado,
    piezas: PIEZAS_NAVIDAD,
  });
}
