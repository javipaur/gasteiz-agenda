const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  euro: "€",
  deg: "°",
  ordf: "ª",
  ordm: "º",
  iquest: "¿",
  iexcl: "¡",
};

/**
 * Desescapa las entidades HTML que llegan dentro de los campos de texto de las
 * fuentes: el Ayuntamiento manda `&aacute;` y `&nbsp;` a puñados, y euskadi
 * manda `&quot;` dentro de los títulos.
 *
 * **Vive aquí y no en `lib/boletin.ts` porque el problema no es del boletín.**
 * Estaba escrito dentro del boletín, que era el único sitio donde se había
 * notado: la web y la app enseñaban `Charla: &quot;La historia…&quot;` y el
 * carrusel lo copiaba a la imagen. Un arreglo que solo alcanza al consumidor
 * que se quejó deja el dato sucio en los otros tres.
 *
 * Se resuelven las numéricas y un juego corto de nombres. Lo que no se conoce
 * se deja **tal cual**: un `&foo;` raro se lee mal, pero convertirlo en nada
 * borra texto.
 */
export function desescaparHtml(texto: string): string {
  return texto.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (entidad, codigo: string) => {
    if (codigo.startsWith("#x") || codigo.startsWith("#X")) {
      const punto = parseInt(codigo.slice(2), 16);
      return punto > 0 && punto <= 0x10ffff ? String.fromCodePoint(punto) : entidad;
    }
    if (codigo.startsWith("#")) {
      const punto = parseInt(codigo.slice(1), 10);
      return punto > 0 && punto <= 0x10ffff ? String.fromCodePoint(punto) : entidad;
    }
    return ENTIDADES[codigo] ?? entidad;
  });
}
