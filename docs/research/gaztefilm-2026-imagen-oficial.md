# GazteFilm Fest 2026: imagen oficial disponible

- Fecha: 2026-11-27.
- Pregunta: ¿tiene la publicación de GazteFilm Fest 2026 una imagen oficial y servible, o hay que preguntar antes de elegir una?
- Estado: **decisión pendiente de la persona que publica**. Hay imágenes oficiales y servibles por HTTP, pero no puedo afirmar que ninguna sea la imagen del programa sin ver los píxeles.
- Alcance: investigación de solo lectura. No se ha tocado código, tests, n8n ni credenciales. Solo se crea este fichero.
- Convención: no existía `docs/research/` en el repo. La nota única anterior es `docs/navidad-2026-guion-reel.md`; esta nota sigue ese estilo de documento fechado y autosuficiente.

## Contexto en el repo

- `lib/archived-events.ts:33` declara el programa contrastado desde `https://www.gaztefilmfest.com/gaztefilmfest2026`.
- `lib/archived-events.ts:82-83` pone hoy como imagen del festival `https://www.kulturklik.euskadi.eus/evento/2026/11/19/gazte-film-fest-2026-festival-de-cine-infantil/webkklik00-detalle/es/images/3.jpg`.
- `app/gazte-film-fest-2026/page.tsx:3,22-34,36-38` construye la página del programa desde esa entrada archivada; no elige imagen propia.

## Método

1. Se abrieron las páginas oficiales del festival, del Ayuntamiento de Vitoria-Gasteiz y de Euskadi/Kulturklik, comprobando estado HTTP y URL final.
2. Se descargaron cinco URLs candidatas con `curl -L`, guardando cabeceras y cuerpo. Para cada una se midió `http_code`, `content_type`, `size_download`, `url_effective` y `num_redirects`.
3. Se comprobó la firma de los bytes descargados (JPEG) y las dimensiones con PIL. No se transformó ni generó ninguna imagen.
4. Se contrastó cada URL con el documento oficial donde aparece: metadatos `og:image`, HTML del evento, entrada de WordPress del Ayuntamiento o ficha de Kulturklik.
5. **Límite real:** en este entorno no hay verificación visual fiable de los píxeles ni OCR que funcionara. Por eso lo que dice el HTML se separa de lo que solo se infiere.

## Candidatos medidos

Todos dieron **HTTP 200**, `Content-Type: image/jpeg`, **0 redirecciones** y firma JPEG válida (`FF D8 FF …`) el 2026-11-27.

| # | URL | Fuente oficial donde aparece | Medición | Relación probada | Lo que no se sabe |
| --- | --- | --- | --- | --- | --- |
| 1 | `https://static.wixstatic.com/media/3f38ec_2d08f7f4206245658a8084f9f85aecd1~mv2.jpg/v1/fill/w_2500,h_3118,al_c/3f38ec_2d08f7f4206245658a8084f9f85aecd1~mv2.jpg` | `og:image` de `https://www.gaztefilmfest.com/gaztefilmfest2026` (HTTP 200, título `Programación \| Gaztefilm Fest 2026`) y también de la home | 660.135 bytes; 2500×3118; EXIF orientation 1; 150 dpi | Es la imagen que el sitio oficial del festival elige para la página del programa. Declarada con `og:image:width=2500` y `og:image:height=3118`. | El HTML no trae `alt`, título ni pie que diga qué representa la imagen. No se puede afirmar que sea el cartel o el programa impreso. |
| 2 | `https://static.wixstatic.com/media/3f38ec_2d08f7f4206245658a8084f9f85aecd1~mv2.jpg` | Original del mismo `media ID` que el candidato 1 | 637.177 bytes; 1240×1547; `Last-Modified: Mon, 09 Nov 2026 17:30:13 GMT`; `ETag: "93d2ef2cfc40672f6829e66fca357ecf"` | Misma imagen que el candidato 1 sin la transformación de Wix. La fecha de modificación es coherente con la edición 2026. Igual que el candidato 1, no identifica el contenido. | Igual limitación: no se sabe qué sale en la imagen. |
| 3 | `https://blogs.vitoria-gasteiz.org/medios/files/2026/11/WhatsApp-Image-2026-11-12-at-13.02.06-scaled.jpeg` | Nota de prensa del Ayuntamiento `https://blogs.vitoria-gasteiz.org/medios/2026/11/12/gaztefilm-fest-celebra-su-novena-edicion-con-mexico-como-pais-invitado-y-arkabia-como-nueva-sede-principal/` (HTTP 200) | 495.544 bytes; 2560×1919 | El artículo se titula `GazteFilm Fest celebra su novena edición con México como país invitado y ARKABIA como nueva sede principal`, enlaza esta imagen completa y muestra el derivado `-420x315.jpeg`. WP media ID `266418`, post ID `266420`, consultados en `/wp-json/wp/v2/media/266418` y `/wp-json/wp/v2/posts/266420`. | El `alt` está vacío. El nombre `WhatsApp-Image-…` y el formato apaisado sugieren foto de prensa; no está probado que sea cartel ni imagen vertical. |
| 4 | `https://www.euskadi.eus/contenidos/evento/2026110909011499/es_def/images/3.jpg` | Ficha de Euskadi del evento `Gazte Film Fest 2026 - Festival de Cine Infantil`, fechas 19–29 noviembre 2026 | 142.637 bytes; 540×360; EXIF `Adobe Photoshop 2021 Windows`, `DateTime: 2026-11-10T17:25:50+01:00` | El HTML pone `<img title="Gazte Film Fest 2026 - Festival de Cine Infantil" alt="Gazte Film Fest 2026 - Festival de Cine Infantil" src="images/3.jpg">`. | Resolución pequeña y formato apaisado; no adecuado para un post vertical sin recorte fuerte. |
| 5 | `https://www.kulturklik.euskadi.eus/evento/2026/11/19/gazte-film-fest-2026-festival-de-cine-infantil/webkklik00-detalle/es/images/3.jpg` | Ficha de Kulturklik del mismo evento (HTTP 200) | 142.637 bytes; 540×360; mismos EXIF y firma que el candidato 4 | Es la que ya usa `lib/archived-events.ts:82-83`. | Es la misma imagen pequeña; estar en el repo no la hace mejor. No se sabe si es cartel, foto o recurso genérico. |

Nota sobre el candidato 4: es oficial, pero su host `www.euskadi.eus` **no** está en la lista de imágenes servibles del repo. El candidato 5, en `www.kulturklik.euskadi.eus`, sí está (`lib/image-hosts.ts:123-125`).

## Servible por HTTP no es lo mismo que servible por la web

Los cinco candidatos se descargan directamente y valen como JPEG. Pero `lib/image-hosts.ts:67-226` es una lista cerrada de hosts que `next/image` y el proxy de imágenes pueden usar; `imagenServible()` (`lib/image-hosts.ts:324`) decide si una tarjeta pinta imagen o degrada a fallback, y `app/api/img/route.ts:65` aplica la misma puerta al proxy.

Con el código actual:

- **Candidato 5 (Kulturklik):** sí se puede servir en la web sin tocar nada.
- **Candidatos 1 y 2 (`static.wixstatic.com`):** no están en `IMAGE_HOSTS`. Si se pusieran en `evento.image`, las tarjetas degradarían a fallback y el carrusel no podría proxyar la imagen. Para usarlos haría falta una decisión y una entrada documentada en `IMAGE_HOSTS`, con su evidencia en `__tests__/next-config.test.ts:95-131` (host medido en vivo con URL y fecha).
- **Candidato 3 (`blogs.vitoria-gasteiz.org`):** tampoco está en `IMAGE_HOSTS`; igual que los de Wix, requeriría permitir el host.
- **Candidato 4 (`www.euskadi.eus`):** no está en la lista; el candidato 5 es su hermano servible.

Esto no cambia si la imagen es oficial. Cambia si la aplicación puede mostrarla hoy.

## Otras comprobaciones

- `https://www.gaztefilmfest.com/` responde 200 y usa el mismo `og:image` que la página del programa.
- El sitemap del festival lista `/gaztefilmfest2026` con `lastmod 2026-11-26`; `/gaztefilmfest2025` y `/gaztefilmfest2024` responden 404. No hay una edición anterior accesible desde esas URLs para comparar carteles.
- La página del programa contiene más recursos Wix/Parastorage (14 media IDs distintos; el más repetido aparece 12 veces). No se han medido todos: son imágenes dentro del programa, no la imagen que la página elige como representación.
- No se ha encontrado una etiqueta `alt`, caption o texto oficial que diga explícitamente «cartel de GazteFilm Fest 2026» en ninguno de los cinco candidatos.

## Recomendación condicional

Para un post o carrusel vertical de 1080×1350:

1. **Mejor candidato, si la persona que publica lo confirma visualmente:** candidato 1 o 2 del sitio oficial del festival. La proporción declarada del `og:image` es 2500:3118 ≈ 0,802, casi exactamente 1080:1350 = 0,8, y es la imagen que el propio festival pone en su página de programación. Pero **hay que mirarla antes**: el HTML no demuestra que los píxeles sean el cartel o el programa.
2. **Alternativa apaisada oficial:** candidato 3, la foto de prensa del Ayuntamiento. Es oficial, reciente, de alta resolución y está ligada a la nota de prensa de la edición; encaja si el diseño usa una foto horizontal, no si se recorta a vertical.
3. **Sin cambios:** candidato 5, la imagen actual de Kulturklik. Es oficial y servible hoy, pero es 540×360 y no está verificado visualmente.

## Decisión pendiente del usuario

No elijo imagen por cuenta propia. Hay que responder una de estas tres opciones:

- **A.** Usar la imagen `og:image` del sitio oficial del festival (candidato 1 o 2), aceptando que hay que permitir `static.wixstatic.com` en `IMAGE_HOSTS` y que primero se mire la imagen para confirmar que es el cartel/programa.
- **B.** Usar la foto de prensa del Ayuntamiento (candidato 3), aceptando que es apaisada y que también habría quepermitir `blogs.vitoria-gasteiz.org`.
- **C.** Mantener la imagen actual de Kulturklik (candidato 5), sin cambios de código.

Si ninguna de las tres sirve, lo que falta no es otro scraping: falta que el festival o el Ayuntamiento publicen un cartel vertical de 2026 en una URL oficial, o que la persona que publica autorice expresamente una de las imágenes anteriores.
