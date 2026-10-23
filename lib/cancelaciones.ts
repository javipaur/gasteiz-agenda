/**
 * ¿El título avisa de que el evento está cancelado?
 *
 * Existe porque `cancelled` no llega relleno desde todas las fuentes: dos de las
 * treinta escriben el aviso dentro del título y dejan el campo vacío, así que el
 * filtro de `lib/agenda.ts` no los ve y el evento se sirve como si fuera a
 * celebrarse. Medido el 23 de octubre de 2026 contra la agenda de producción:
 * **cuatro eventos en tres días** —tres visitas guiadas del Palacio de Villa Suso
 * y un concierto de `euskadi`— estaban en ese caso, y dos de ellos entraban en el
 * carrusel de Instagram de ese día como parte de «los diez planes».
 *
 * El título **no se toca**: la regla del proyecto es que un título que viene de
 * la fuente se sirve tal cual, con su ortografía de origen. Lo único que se
 * decide aquí es si el evento entra en la agenda, que es exactamente lo que ya
 * hacía el campo `cancelled` cuando la fuente se molestaba en rellenarlo.
 *
 * Solo `cancelad*` porque solo eso está medido. `anulad*` y `suspendid*` dirían
 * lo mismo y no tienen ningún caso en la agenda real; el día que aparezca uno se
 * añade aquí con su caso, no por si acaso.
 *
 * Queda fuera a propósito el título que usa la palabra sin ser un aviso («El
 * concierto cancelado» como nombre de una obra). Se acepta el falso positivo
 * porque el error contrario —publicar un evento anulado— cuesta más, y porque
 * hoy no hay ninguno.
 */
export function tituloCancelado(titulo: string): boolean {
  return /\bcancelad[oa]s?\b/i.test(titulo);
}
