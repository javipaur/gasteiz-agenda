# El resumen del día y del finde, por correo

**Fecha:** 2026-10-09 · **Revisado:** 2026-10-09, tras las decisiones de la segunda ronda
**Marca:** Gasteiz Click (`gasteizclick.javierpalacio.es`)

## Qué quiere

Que llegue un correo cada día de publicación con el carrusel ya hecho: las imágenes
numeradas y en orden, el texto del pie para copiar y pegar, y el enlace con la utm de la
fecha. Quien lo publica abre el correo y monta el post.

**No publica el repositorio.** Ni token de Instagram, ni Graph API, ni contenedor, ni
riesgo de baneo. El repositorio genera el material y lo manda por correo, que es la
decisión del spec del 6 de octubre (`2026-10-06-cobertura-recomendados-instagram-design.md`,
Fase 3) con una pieza añadida: el envío.

## La revisión, y por qué cambió

La primera versión de este spec era **un solo post del fin de semana, los viernes**. Tres
decisiones la cambiaron, y las tres vienen de mirar el paquete real en producción antes de
escribir una línea de código.

**1. Tres ventanas, no una.** Jueves, viernes y finde. El motivo no es cobertura sino
cadencia: el viernes sale el finde, y el día que se publique se verá si un post por semana
es suficiente. Con tres se mide antes de decidir la frecuencia.

**2. Un mismo evento con dos días cuenta una vez.** El paquete del finde del 10 y 11 de
octubre traía **`visita-guiada-palacio-de-villa-suso` dos veces** — sábado y domingo — con
la misma foto y la misma línea de texto. Dos diapositivas idénticas en un post publicado
parecen un error. Ahora se convierte en una entrada que dice los dos días.

**Y por eso la deduplicación va en `lib/recomendados.ts` y no en el paquete.** El selector
es el único que usan el post, `/hoy` y el riel de la home. Si la hubiera en el paquete, el
post mostraría un evento y la página dos, que es exactamente el desajuste que se corrigió
el 9 de octubre (`3da8610`: el post enseñaba 9 planes y la página 8). Una decisión de qué
enseñar no puede vivir en uno de los tres que la enseñan.

**3. Seis diapositivas, no nueve.** Con nueve plazas, dos se las lleva el mismo evento
en dos días. Seis es el punto en el que un carrusel se lee entero en el móvil.

**Lo que NO se ha decidido, y es lo más importante que queda:** el selector **no tiene tope
por categoría**, y en el finde del 10 y 11 de octubre cinco de los nueve planes eran
conciertos. Se sabe y se acepta: lo que se está midiendo es si la cadencia funciona, y dividir
por categoría antes de tener una medición es optimizar lo que no se ha observado.

## Lo que ya funciona y no se vuelve a hacer

El paquete diario está implementado y medido en producción el 9 de octubre de 2026:

```
GET /api/promo?desde=2026-10-10&hasta=2026-10-11
→ portada + 9 diapositivas + "ESTE FINDE en Vitoria-Gasteiz: 9 planes que recomendamos"
```

Las tres rutas (`app/api/promo/route.ts`, `…/[fecha]/portada/route.tsx`,
`…/[fecha]/evento/[slug]/route.tsx`), `lib/promo.ts` con `TAMANO_PROMO`, `urlDePromo`,
`radioImagenPromo`, `urlImagenPromo` y `textoDelPie`, y la página `app/hoy/page.tsx` que
recibe el tráfico del post.

**Y `/api/promo` ya es público** — está en `PUBLIC_API_NAMESPACES`
(`lib/api-public-routes.ts:163`), que es lo que permite que Meta descargue las imágenes
sin credencial. Ese caso ya está cubierto y documentado; este spec no lo toca.

## Lo que se ha medido antes de decidir nada

### El agregado no guarda eventos pasados

Esto tumba una opción que parecía la buena, y es lo primero que hay que escribir.

| Ventana | Planes devueltos |
| --- | --- |
| `desde=2026-10-10&hasta=2026-10-11` (este finde) | **9** |
| `desde=2026-10-03&hasta=2026-10-04` (finde pasado) | **0** |
| `desde=2026-09-26&hasta=2026-09-27` (finde anteanterior) | **0** |
| `desde=2026-10-05&hasta=2026-10-08` (lunes a jueves) | **0** |

`getAgendaEventos({ includePast: true })` existe (`lib/agenda.ts:274`) y devuelve lo que
hay en la caché, pero los scrapers solo devuelven lo que viene: **no hay histórico**.

Consecuencia directa, y es la razón de la puerta 2: una comprobación del tipo "este finde
viene flojo respecto a los dos anteriores" compararía contra 0 y 0, y `9 < 0,5 × 0` es
falso siempre. **La puerta no se dispararía nunca.** Sería un test que pasa sin comprobar
nada, que es la forma que ya tomó este repo de fallar en silencio.

### La salud del agregado sí está, y es gratis

`GET /api/v1/salud` responde, medido el 9 de octubre de 2026:

```json
{ "sourcesTotal": 37, "sourcesOk": 37, "sourcesFallidas": [], "completa": true }
```

`getAgendaSalud()` comparte la clave `agenda-all-v2` con `getAgendaEventos`
(`lib/agenda.ts:297`), así que **preguntar si el agregado está entero no cuesta un scrape
que no se haga ya**: es la misma caché que carga la home.

Esto mide exactamente el fallo que había que detectar. El riesgo real de publicar
automáticamente no es que el finde esté vacío, es que **un scraper haya caído y el post
salga con tres eventos sin que nadie se entere**, porque un `[]` por fallo es
indistinguible de un finde flojo. `sourcesFallidas` lo distingue.

### El correo no admite adjuntos

`sendMail` (`lib/mail.ts:33`) acepta `to`, `subject`, `html` y `text`. Nada de
adjuntos. Nodemailer los soporta, así que es un campo más en el tipo y una línea en el
`sendMail` del transporte. Es el único cambio en código compartido de todo este spec.

### El disco de Dokploy no es un canal durable

`data/` y `.data/` se pierden en cada redeploy si no hay volumen persistente montado, y
eso **sigue sin poder comprobarse desde el repo**. Es una de las dos cosas abiertas que
no son de código.

Por eso el correo lleva las imágenes **dentro** y no solo los enlaces: si el disco está
vacío, el correo sigue siendo publicable. Los ficheros en disco son la comodidad —verlas
en grande, recuperarlas si el correo falla— y no la garantía.

## Las piezas

### La ventana de cada día

La ventana ya no la decide una función que solo sabe de findes. La decide
**`ventanaDelDia(fecha)`**, que devuelve `{ desde, hasta, etiqueta } | null`:

| El cron corre un… | Ventana | Etiqueta del texto |
|---|---|---|
| Jueves | ese jueves | `HOY` |
| Viernes | ese viernes | `HOY` |
| Sábado | ese sábado y el domingo | `ESTE FINDE` |
| Cualquier otro día | **`null`** | — |

**Un solo cron diario, no tres tareas en Dokploy.** Tres tareas son tres cosas que
configurar y que se desincronizan el día que una falla; una es una regla de calendario que
se prueba con una tabla.

**Que devuelva `null` en vez de una ventana vacía es lo que permite que el cron corra los
siete días.** Los otros tres días el caso no es "no hay planes", es "no toca", y la
diferencia se ve en la salida: código 0, un aviso en consola y ningún correo. Si en vez
mandara un correo vacío el martes, la segunda semana dejaría de mirar el correo.

**La tabla de los cinco días no es un adorno.** Es lo que convierte "el jueves publica el
jueves" en un test y no en una intención, y es lo que da dónde mirar el caso raro del
domingo, que puede devolver el finde en curso en vez de saltar al siguiente.

### `lib/recomendados.ts`: la deduplicación

**`colapsarDiasConsecutivos(lista)`** recibe los eventos de una ventana y devuelve la
misma lista con los que comparten título normalizado **fundidos en uno que lleva `dias`**.

`Evento` gana un campo opcional **`dias?: string[]`**: los días en que ocurre, cuando es
más de uno. Opcional a propósito, porque hay cientos de tests que construyen eventos a
mano y un campo obligatorio los rompe todos.

**Normalizar el título es la parte que hay que acertar.** Dos eventos con el mismo título
en días distintos son casi siempre el mismo evento en dos fechas —una visita guiada que
abre sábado y domingo— y a veces son dos cosas distintas que comparten nombre. **La regla
es conservadora a propósito**: compara el título en minúsculas, sin acentos y sin
puntuación, y **solo funde si están en la misma ventana**. Ante la duda enseña las dos: dos
entradas parecidas son un post feo, y un evento fundido con otro que no era suyo es un dato
falso en la agenda.

Va en el selector y **no** en el paquete, por lo que explica la revisión: el post, `/hoy` y
el riel de la home enseñan lo mismo porque son el mismo selector.

### `lib/promo.ts`: dos funciones puras

**`paqueteDePromo(lista, { desde, hasta })`** devuelve la forma cerrada de cinco
claves —`portada`, `imagenes`, `pie`, `texto`, `enlace`— que hoy construye
`app/api/promo/route.ts`. Recibe **la lista ya seleccionada**, no los eventos.

El motivo es que quien la llama es quien ha llamado al selector, y el script necesita
quedarse con la lista para poner el título de cada diapositiva bajo su imagen en el
correo. Si `paqueteDePromo` recibiera los eventos y llamara a `recomendados` por dentro,
el script tendría que volver a seleccionar para tener los títulos, y dos llamadas al
selector son dos reglas que divergen el día que se toque una.

El paquete **deja de definirse en la ruta**. La ruta pasa a ser un envoltorio de diez
líneas que llama a la hoja, y el script importa la misma hoja.

El motivo es el de siempre en este repo: si el script derivara el paquete por su cuenta,
el post del correo y `/api/promo` divergirían el día que se tocara uno, y nobody se
enteraría porque los dos seguirían funcionando. Es el patrón hoja/composición de
`lib/source-data.ts` y `lib/source-registry.ts`, aplicado al paquete.

**`finDeSemanaDe(fecha)`** devuelve `{ desde, hasta }`: el sábado y el domingo más próximos
que **aún no han pasado**, y si hoy ya es sábado o domingo, el fin de semana **en curso**.

La regla tiene cinco casos y uno de ellos es el que importa:

| Hoy | Devuelve |
| --- | --- |
| jueves 8 | sábado 10, domingo 11 |
| viernes 9 | sábado 10, domingo 11 |
| **sábado 10** | sábado 10, domingo 11 |
| **domingo 11** | sábado 10, domingo 11 |
| lunes 12 | sábado 17, domingo 18 |

El domingo es el que rompe la regla ingenua de "sábado más próximo mayor o igual que
hoy": el 11 devolvería el 17 y mandaría el finde equivocado justo el día que el finde
empieza. Por eso la regla es "más reciente sábado que aún no ha pasado", no "siguiente
sábado".

Son fechas **locales**. Europe/Madrid y el huso ya le costaron un test a este repo:
`jest.config.ts` fija `TZ` en el proceso principal, y con UTC `localDateStr(d)` y
`d.slice(0,10)` son la misma función para toda fecha. `finDeSemanaDe` usa `localDateStr`.

### `lib/mail.ts`: adjuntos

Un campo más en `SendMailOptions` y su reenvío al `sendMail` de nodemailer:

```ts
attachments?: Array<{
  filename: string;
  content: Buffer;
  contentDisposition: "inline" | "attachment";
  cid?: string;
}>;
```

Sin cambios en la regla que ya tiene: sin `EMAIL_USER`/`EMAIL_PASS`, en producción sigue
devolviendo `ok: false` y no finge. Este spec no la toca.

### `scripts/enviar-promo.ts`

Corre **todos los días** por cron, y en tres de ellos hay algo que hacer. En orden:

1. **Ventana.** `ventanaDelDia(hoy)`. Si devuelve `null`, no es un día de publicación:
   avisa y sale con **0** sin tocar nada más.
2. **Agregado.** `getAgendaEventos()` y `recomendados` de `lib/recomendados.ts`, el mismo
   selector que la web. No se reimplementa la elección de eventos.
3. **Puerta 1 — salud.** `getAgendaSalud()`. Si `sourcesFallidas` no está vacío o
   `completa` es `false`, **no escribe nada**, avisa y sale con código 1.
4. **Puerta 2 — mínimo.** Si la lista tiene menos de tres planes, escribe los ficheros,
   avisa y sale con código 1.
5. **Descarga.** Baja portada y tarjetas de las URLs que ya son públicas, en orden.
6. **Disco.** `data/promo/<desde>/` con `01-portada.png`, `02-…png`, … y `paquete.json`
   al lado. Se escribe **antes** de mandar el correo, no después: si el envío falla, lo
   que se necesita ya está en el disco.
7. **Correo.** A `PROMO_PARA`. Las imágenes inline **y** adjuntas, el texto del pie en
   texto plano para copiar y pegar, el enlace con la utm visible y pulsable.
8. **Salida.** Código 1 si el envío falla, con la razón.

**Las dos puertas no se comportan igual, y no por capricho.** La puerta 2 —menos de tres
planes— **escribe los ficheros antes de salir**, porque el paquete existe y solo es
fino: quien lo encuentre en el disco decide si lo publica. La puerta 1 —el agregado
degradado— **no escribe nada**, porque si `sourcesFallidas` no está vacío el paquete
que saliera de ahí no es un finde flojo sino medio finde, y dejar medio paquete en
disco es dejarlo a un clic de publicarse. Solo avisa, con la lista de fuentes que
fallan, y sale con 1.

Las dos dicen por qué en la consola. Ninguna deja la viernes en blanco sin explicación.

**El script no habla con su propio despliegue.** Llama a `getAgendaEventos()` y a
`getAgendaSalud()` directamente, como `scripts/send-newsletter.ts` después de la Fase 1.
Un script del repo no debería depender de que su propio despliegue le deje pasar.

Lo que sí queda atado a la red es SMTP, y por eso mismo `lib/mail.ts` falla de forma
explícita en producción si faltan las credenciales.

### El correo

| | |
| --- | --- |
| Asunto | `Finde 10–11 oct · 9 planes` |
| Cuerpo | Las imágenes en línea, en orden, con el número y el título de cada una |
| Adjuntos | Las mismas, numeradas desde 01: `01-portada.png`, `02-…png`, … |
| Bloque final | El texto del pie en texto plano, para copiar y pegar tal cual |
| Enlace | Con la utm por fecha, visible y pulsable |

La cantidad no es fija: es la portada más lo que devuelva el selector, con un tope de
nueve diapositivas (`MAX_DIAPOSITIVAS` en `app/api/promo/route.ts:12`), porque Instagram
no acepta más de diez. Con el tope lleno son diez imágenes; con un finde flojo, menos, y
la numeración empieza igual en 01 para que el orden nunca se tenga que deducir.

**Las imágenes viajan dos veces a propósito.** Una entrada `inline` con `cid` para verse
en el cuerpo, y otra `attachment` con nombre para el clip. No hay un camino único entre
los clientes de correo: el que funciona en Gmail no es el que funciona en el cliente por
defecto de iOS. Con la imagen duplicada funciona en los dos, y son 1–3 MB — Gmail aguanta
de sobra y el límite de Gmail es 25 MB.

Los títulos de los eventos vienen de 28 sitios sin esquema, así que **se escapan** con el
helper que ya tiene `lib/email.ts`. Sin eso, un título con `<` o `"` rompe el HTML.

### `PROMO_PARA`

Una dirección, no la lista de suscriptores. Esto es interno y no va a nadie más. Sin ella,
el script escribe los ficheros y sale con código 1: es un destinatario ausente, no un
paquete perdido.

## Decisiones tomadas (no revertir sin motivo)

- **El repositorio no publica.** Es la decisión del spec del 6 de octubre y sigue siendo
  la buena. El motivo es que publicar exige una credencial de la Graph API, y esa
  credencial exige una cuenta profesional enlazada a una Página de Facebook: una condición
  que **no se puede comprobar desde el repo** y de la que depende que todo lo demás
  funcione. El correo no depende de ninguna de las dos.
- **El envío es automático, la publicación no.** El cron corre solo; el post lo monta una
  persona. El spec del 6 de octubre dice que *"elegir qué merece la pena en redes es una
  decisión editorial y el repositorio no la toma"*, y esa frase sigue siendo cierta: lo
  que se automatiza es la preparación, no la decisión.
- **Las dos puertas son de datos, no de calendario.** Un día que el cron se retrase y se
  solapen dos findes no es un problema: el segundo finde ya no es este. Un día que el
  agregado venga a medias sí lo es, y eso es lo que las puertas miran.
- **`finDeSemanaDe` es una función pura con fecha de entrada, no un `new Date()` dentro.**
  Con `hoy` como argumento, los cinco días de la semana se prueban fijando la fecha. Es
  lo que hace testeable el caso del domingo.

## Fuera de alcance

- **Historias.** Son 9:16, no 4:5, y el paquete entero está en 1080×1350 porque es lo que
  ocupa más feed. Una historia con esas proporciones sale con bandas negras: hace falta
  otro tamaño, otro diseño y otro endpoint. Es otro spec.
- **El post diario.** Este cron es solo el finde. El selector ya sirve la ventana de un
  día; lo que no hay es la decisión de a qué hora publicarlo todos los días.
- **Cualquier llamada a la Graph API.** Si algún día se automatiza la publicación, es otro
  spec, y este cron ya le ha dado el paquete a quien publica.
- **Reels y vídeo.** `ImageResponse` genera PNG; un vídeo es otra historia.
- **Medir qué post trajo visitas.** El `utm_content` por fecha ya está en el enlace, pero
  `app/components/Analytics.tsx` devuelve `null` sin `NEXT_PUBLIC_ANALYTICS_URL`. Con la
  variable puesta funciona; sin ella el parámetro es decorativo, y eso no se arregla aquí.

## Cómo se prueba

| Qué | Cómo |
| --- | --- |
| `finDeSemanaDe` | Los cinco días de la semana con fecha fija, y en particular el **domingo**, que es el que puede devolver el finde en curso en vez de saltar al siguiente |
| `paqueteDePromo` | Forma cerrada de claves, y que las URLs son absolutas y del sitio desplegado |
| El script | Como programa, con el `fetch` de imágenes sustituido: que **sin destinatario escriba los ficheros y no el correo**, y que con menos de tres planes tampoco escriba el correo |
| La puerta de salud | Que con `sourcesFallidas` no vacío salga con 1 y **no** intente mandar correo |
| `sendMail` con adjuntos | Nodemailer mockeado, y que en producción sin credenciales siga devolviendo `ok: false` |
| El HTML del correo | Que un título con `<` y con `"` salga escapado |

Cada una con rojo-verde: se ve el fallo antes del arreglo.

## Riesgos

- **El cron depende de una variable que no se ve desde el repo.** Si Dokploy no tiene
  `PROMO_PARA`, `EMAIL_USER` o `EMAIL_PASS`, el viernes no llega nada. Sale con código 1
  y queda escrito en el disco, así que se recupera a mano; pero no hay aviso proactivo.
  Es el mismo compromiso que ya arrastra el newsletter.
- **La imagen duplicada duplica el peso del correo.** 1–3 MB, y el límite de Gmail son
  25 MB. Con diez diapositivas no hay problema; con más habría que medirlo.
- **Los ficheros en disco no sobreviven a un redeploy** sin volumen persistente. Por eso
  el correo lleva las imágenes dentro y no solo sus rutas.
- **`finDeSemanaDe` es una decisión de calendario.** El finde de un festivo que se
 traslada al lunes no existe todavía, y este cron lo mandaría el sábado siguiente. Es
  el comportamiento esperado mientras no haya un calendario de festivos, y es el mismo
  límite que ya tienen `lib/season.ts` y `lib/blanca.ts`.