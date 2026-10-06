# Cobertura, recomendados y material para redes

**Fecha:** 2026-10-06
**Marca:** Gasteiz Click (`gasteizclick.javierpalacio.es`)

## Qué quiere

Tres cosas, en este orden porque las tres leen del mismo agregado:

1. **Que salgan todos los eventos**, por categoría y por día, de las 28 fuentes y del
   Ayuntamiento, consumiendo todos sus ids.
2. **Un "Recomendados para hoy"** en la web, decidido por cuántos datos hay y no solo
   por popularidad.
3. **El resumen para Instagram** —diario, semanal y de finde— en material generado por
   el propio sitio y publicado a mano.

La marca se llama Gasteiz Click. `vitoria.planesyocio.com` y `@vitoria.planesyocio` son
del competidor y no aparecen en ningún fichero de este repo; son el criterio de
comparación, no parte del sistema.

## Lo que se ha medido antes de decidir nada

Todo lo de aquí está medido contra el sitio el 6 de octubre de 2026, no deducido.

### El calendario municipal se trunca en el 45%

`CalendarioServlet` **corta a unos 50 resultados por consulta**. Lo demuestra partir la
misma consulta en dos: una ventana de 12 meses devuelve 50, y la mitad que le toca a esa
ventana devuelve 0 o 4.

| tipo | 1 ventana de 12 meses | 12 ventanas de 1 mes |
| --- | --- | --- |
| Exposición (7) | 54 | **157** |
| Charla (3) | 50 | **132** |
| Talleres (10) | 50 | **116** |
| Otros (99) | 51 | **106** |
| Feria (14) | 50 | **80** |
| Visita guiada (15) | 50 | **78** |
| Jornada (6) | 50 | **66** |
| Teatro (13) | 50 | **61** |
| Concierto (2) | 33 | 34 |
| Danza (4) | 10 | 10 |
| Cine (12) | 6 | 6 |
| Presentación (11) | 5 | 5 |
| Fiesta (9) | 5 | 5 |
| Concurso (1) | 2 | 2 |
| **únicos** | **461** | **840** |

**379 eventos, el 45%, no llegan a la agenda.** Y el origen del recorte está en el
repo: la Fase 3 quitó el `fetchAllDays` que iteraba día a día con la justificación de
"27 peticiones pasaron a ser una", y esa única petición es la que trunca. Una optimización
se tragó los datos.

### Dos datos que cambian el plan

- **El campo `tipo` de la respuesta viene siempre `null`.** En los 120 eventos de una
  ventana sin filtro, ninguno lo trae. No se puede partir por categoría en local: hay
  que consultar un `tipo` por consulta.
- **La respuesta son dos secciones**, `exposiciones` y `actividades`, cada una con su
  `resultados`. `municipal.ts:155` las aplana con `Object.values(data).reduce(...)`.

### Los dos tipos que faltaban, medidos otra vez

Ayer se decidió dejar fuera el 14 «Feria» y el 11 «Presentación» por 4 y 3 eventos.
Los números son otros:

- **Tipo 14 trae 44 eventos nuevos**, no 4. Y **casi todos son mercados**:
  "Mercado de Lakua-Arriaga", "Mercado de la Plaza Simón Bolívar", "Mercado de la Plaza
  Santa Bárbara", "Mercado dominical de coleccionismo", "Mercado de la Almendra", "Feria
  de bodas". El Ayuntamiento los agrupa bajo "Feria" porque es su taxonomía interna;
  para quien busca planes, son mercados.
- **Tipo 11 trae 3 eventos nuevos** y los tres son de libro: "Feria del Libro: Coloquio
  con Palabra Joven", "Feria del Libro: Entrevista y firma con Mikel Santiago",
  "Presentación de libro: El libro de la vida".

Decisión: **una categoría nueva "Mercados"** para el tipo 14, con color y peso.
**Presentación va a "Conferencias"**, que ya existe: dos de los tres son colloquia y el
tercero, una presentación de libro. La taxonomía pasa de 15 a 16 categorías y ningún cubo
se queda con menos de 30 eventos.

### Lo que ya existe y no hay que volver a hacer

- `lib/og-image.ts` genera imágenes en servidor con `ImageResponse`. Las tarjetas de
  Instagram son eso.
- `instrumentation.ts` + `lib/scheduler` + `/api/push/send` son el patrón de trabajo
  programado con salida desde fuera. No se usa en esta fase.
- `app/components/Analytics.tsx` ya existe y es opcional: **devuelve `null` sin
  `NEXT_PUBLIC_ANALYTICS_URL`**.

---

## Fase 1 — Paginación adaptativa del calendario municipal

### El arreglo

Dentro de `fetchMunicipalCalendar`, que es la única puerta al calendario:

1. La petición de 12 meses que ya hace hoy.
2. Si vuelve **≥ 45** filas, se repite **mes a mes**: 12 peticiones secuenciales.
3. Si un mes vuelve también ≥ 45, se parte en dos mitades y se repite. **Un** nivel de
   recursión, y nada más.

El umbral es 45 y no 50 a propósito. **El tope del servlet no es un número único**, y
esto se vio al medir: una consulta con `tipo` devuelve 50 o 54 según el tipo, y la
consulta **sin filtro** —`municipal-general`— devolvió 120 de una vez. El tope está por
sección, no por consulta. Con 45, cualquier respuesta que se acerque a cualquiera de los
dos topes se vuelve a paginar, y `municipal-general` se pagina siempre, que es lo
correcto: es la única entrada que ve todos los tipos a la vez.

Que `municipal-general` se pagina siempre tiene un coste que se acepta en knowingly:
12 peticiones más para una entrada que no las necesita para ser correcta. La alternativa
es un umbral por entrada, y un umbral por entrada es una lista mantenida a mano que se
pudre el día que un tipo nuevo entre —que es justo lo que pasó ayer dos veces—.

**Secuencial por diseño.** `aggregate` lanza las entradas municipales en paralelo: hoy
son 16 y con las dos de este fase serán 18. El comentario del timeout de
`municipal.ts:135` dice que 16 en paralelo al mismo servlet con el mismo `fd`/`fh` fueron
lo que se quedó a 400 ms de cortar en un arranque en frío. Las ventanas de una entrada van
en serie; la concurrencia real se queda en el número de entradas, que sube de 16 a 18.

### El precio, y cómo se paga

15 peticiones pasan a ser hasta 168. Dos formas de pagarlo:

- **`cacheTtlMs: 2h`** en las entradas municipales, como ya hace `rula` con sus 6,5 MB.
  Sin esto son 168 peticiones cada 5 minutos contra un servidor municipal.
- **Arranque en frío más largo.** Hoy se mide entre 5,6 s y 19,7 s. Con paginación sube,
  y la cifra exacta no se promete aquí: **se mide durante la implementación**.

Si el arranque en frío medido supera los **30 s**, el recorte es este y no otro: los
tipos que no saturan se quedan con una sola ventana anual, que es el comportamiento de
hoy, y solo se paginan los que la necesitan. Se decide con el número, no antes.

### Las dos entradas

`municipal-mercados` → `scrapeMunicipalCalendar({ tipo: [14] })`, categoría Mercados.
`municipal-presentaciones` → `scrapeMunicipalCalendar({ tipo: [11] })`, categoría
Conferencias.

Las dos van **antes** de `municipal-infantil`, que se come el `dest`, y de
`municipal-general`, que va última con `priority: 1`.

### El test que faltaba

Una fixture nueva con el array `filtros` que devuelve el propio servlet —los 14 tipos
con su id y su número— y un test que compare esos ids contra los que consumen los
`RUNNERS` de `lib/source-registry.ts`.

Es lo que convierte "consumimos todos los ids" en invariante comprobable, y es
justamente lo que habría escondido los dos tipos de ayer: el guard actual prohíbe
**cadenas** en `tipo`, que es otra cosa.

La fixture se captura una vez y se versiona. El día que el Ayuntamiento añada un tipo,
el test se pone rojo y obliga a decidir qué se hace con él en vez de que desaparezca.

---

## Fase 2 — Recomendados y `/hoy`

### La señal que hoy se tira

`lib/agenda.ts:186-190` roba `image`, `description` y `location` al perdedor del dedupe
y **descarta el resto**, incluida la procedencia. El agregado sabe cuántos eventos
duplicados ha juntado y tira ese número.

Se añade **`corrobora?: number`** a `AgendaEvento`: cuántos ids de fuente contaban cada
evento. Opcional a propósito, para no romper los muchos tests que construyen eventos a
mano.

### El selector

`lib/recomendados.ts`, con una firma y tres consumidores:

```
recomendados(eventos, { desde, hasta, limite }) => AgendaEvento[]
```

Filtra por ventana y ordena por `scoreEvento` más una bonificación de corroboración,
**+10 por fuente extra, tope en tres extras** (+30). El tope importa: los pesos de
`lib/popularity.ts` van de 5 a 40, así que sin tope un evento con seis fuentes de peso
mínimo (30) aplasta a un concierto del Ayuntamiento (25) que es lo más real de la
agenda. Con tope, tres fuentes coinciden y ya no acumula más.

`limite` es 8 por defecto, que es lo que cabe en una pantalla y lo que entra en un
carrusel con la portada. Sin tope por categoría, que es la decisión tomada.
Consecuencia asumida: un día con cinco conciertos da cinco conciertos, y la sección lo
dirá con sus repeticiones. Si molesta, el tope es un parámetro de tres líneas más tarde.

### `/hoy`

Va página propia, y esto es una corrección de un planteo anterior: el post de Instagram
es la fuente de tráfico y **necesita una landing page que merezca la pena**. La home no
es "hoy".

Renderiza lo que devuelve el selector para la fecha de hoy, y admite `?fecha=` para las
ventanas de semana y de finde que consume el paquete de redes. Reutiliza `EventCard`, que
ya sabe degradar imágenes.

---

## Fase 3 — Material para Instagram

Sin credenciales, sin Graph API y sin automatizar la publicación. El repositorio
genera el material; una persona lo publica.

### Las rutas

| Ruta | Qué devuelve |
| --- | --- |
| `/api/promo/[fecha]/portada` | PNG 1080×1350 con la fecha y el número de eventos |
| `/api/promo/[fecha]/evento/[slug]` | PNG 1080×1350 por evento recomendado |
| `/api/promo/[fecha]` | JSON: URLs de las imágenes, pie de foto y caption |

Un endpoint y no un script porque **las URLs tienen que ser públicas** para que la API
de Instagram las pueda leer, y lo público es el sitio, que está desplegado en
`https://gasteizclick.javierpalacio.es/` — la misma base que `metadataBase` en
`app/layout.tsx:37`. Las direcciones del paquete serán, por tanto,
`https://gasteizclick.javierpalacio.es/api/promo/…`. El JSON es lo que se copia.

1080×1350 es 4:5 y ocupa más pantalla en el feed que el cuadrado.

### Las tres cadencias

Hoy, los próximos 7 días, y el fin de semana (sábado y domingo). Las tres salen del
mismo selector con distinta ventana —`/api/promo/[fecha]` acepta `?hasta=` y `?finde=`.

**Tope de 10 diapositivas**, que es el límite de Instagram: portada más 9 eventos, o sea
el `limite` del selector en 9 y el selector en 8 por defecto. Si un día trae más, el
selector se recorta y el caption lo dice.

**El texto va en el caption, no en la imagen.** El texto de una imagen no se lee, el de
Instagram sí, y el de la imagen no lo indexa nadie.

### El `utm_content`

El competidor usa `utm_content=link_in_bio` fijo, que no le dice qué post funcionó. El
nuestro lleva **la fecha**: `?utm_source=ig&utm_medium=social&utm_content=gasteizclick-2026-10-06`.

**Y eso solo sirve si `NEXT_PUBLIC_ANALYTICS_URL` está puesta en Dokploy**, porque
`app/components/Analytics.tsx` devuelve `null` sin ella. No es verificable desde el
repo. Si no lo está, hay dos salidas: ponerla, o aceptar que el `utm_content` es
decorativo y decirlo aquí.

---

## Fuera de alcance

- **Agrupar los 44 mercados semanales en una entrada con "cada miércoles".** El servlet
  no declara `numeroRepeticiones` —medido: viene vacío en todos los eventos paginados—,
  así que detectarlo sería agrupar por título y fecha a ojo. Un error ahí mete basura en
  la agenda. Se anota para después, no se hace ahora.
- **Publicar solo.** Decidido: elegir qué merece la pena en redes es una decisión
  editorial y el repositorio no la toma.
- **Comparación con `vitoria.planesyocio.com`.** Es investigación, no diseño, y no
  bloquea nada de esto.
- **Una página `/agenda/[dia]`.** El agrupado por día que ya hay en `/agenda/[mes]` y en
  `NextDaysSection` cubre el caso. Si sale como necesidad, es su propio spec.

---

## Cómo se prueba

| Qué | Cómo |
| --- | --- |
| Paginación adaptativa | Test de `fetchMunicipalCalendar` con un doble de `fetch`: una ventana que satura y otra que no, y se comprueba cuántas peticiones salen y cuántos eventos entran |
| Los 14 tipos consumidos | Fixture de `filtros` + comparación contra los `RUNNERS` |
| Las dos entradas nuevas | Ampliar las listas exactas de `source-registry.test.ts` y el enum del OpenAPI |
| `corrobora` | Que dos fuentes con el mismo título y fecha den `corrobora: 2`, y que una sola dé `1` |
| El selector | Ventana, orden, límite y que un día sin nada devuelva lista vacía en vez de inventar |
| `/hoy` | Route handler: que `?fecha=` de mañana no devuelva los de hoy |
| Las tarjetas PNG | Que devuelvan `image/png` y el tamaño pedido, sin assertar el píxel |
| El paquete JSON | Forma cerrada de claves y que las URLs que devuelve son servibles |

Cada uno con rojo-verde: se ve el fallo antes del arreglo, no después.

## Riesgos

- **Carga sobre el Ayuntamiento.** 168 peticiones por arranque en frío es mucho, aunque
  la caché de 2 h lo amortigua. Si hay que retirarse, el recorte del párrafo de los 30 s.
- **Arranque en frío.** Sin cifra medida todavía. El de 30 s es el umbral de decisión.
- **Mercados en la agenda.** 44 eventos semanales nuevos. Con su categoría son
  encontrables; la alternativa era perderlos.
- **Sin analítica no hay medición.** El `utm_content` por fecha solo se lee si
  `NEXT_PUBLIC_ANALYTICS_URL` está puesta en Dokploy.