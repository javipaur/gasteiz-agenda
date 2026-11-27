# Navidad 2026: las horas «POR CONFIRMAR» del reel

- Fecha: 2026-11-27. Las fuentes oficiales se han vuelto a consultar hoy; el
  repo marca `CONSULTADO = "2026-11-26"` en `lib/navidad-vitoria.ts:13`.
- Pregunta: ¿por qué el reel pone `POR CONFIRMAR` en la hora de inicio de
  `chocolatada`, `arbol` y `luces`, y qué dice exactamente la fuente oficial?
- Estado: **decisión pendiente de la persona que publica**. La hora concreta
  existe para el acto de encendido, no para esos tres planes. No se ha tocado
  código, tests, reel, workflow ni credenciales. Solo se crea este fichero.
- Alcance: investigación de solo lectura contra fuentes primarias municipales.
  GasteizBerri se consultó como contexto, **no** como fuente para asignar horas.
- Convención: no hay una convención escrita para notas de investigación. El
  directorio `docs/research/` ya contiene `gaztefilm-2026-imagen-oficial.md`,
  una nota fechada y autosuficiente; este fichero sigue ese mismo formato.

## Contexto en el repo

- `lib/navidad-vitoria.ts:10` define `POR_CONFIRMAR = "POR CONFIRMAR"` como
  «la marca literal de lo que no tiene fuente para 2026. Nunca se rellena».
- `lib/navidad-vitoria.ts:117-130` (`chocolatada`), `133-143` (`arbol`) y
  `146-157` (`luces`) son los tres eventos con `hora: POR_CONFIRMAR`. El
  evento `encendido` de `lib/navidad-vitoria.ts:99-115` sí tiene hora concreta:
  `17:30`, con `horaFin: "18:00"`.
- `docs/navidad-2026-guion-reel.md:28-36` promete **fecha de inicio y hora de
  inicio** para los trece planos, y muestra esos tres como `POR CONFIRMAR`.
- `lib/navidad-reel.ts:43-45` marca `pendiente` cuando **algún** campo es
  exactamente igual a `POR_CONFIRMAR`; `scripts/reel-navidad.ts:98-103` pinta
  por eso un distintivo rojo, y `scripts/reel-navidad.ts:116-117` pinta la hora
  bajo la etiqueta fija **«EMPIEZA A LAS»**.

## Fuentes oficiales primarias

### 1. Nota de prensa municipal, 25 de noviembre de 2026

URL: https://blogs.vitoria-gasteiz.org/medios/2026/11/25/vitoria-gasteiz-encendera-manana-la-navidad-2026/

HTTP 200 el 2026-11-27 (76.588 bytes). Fragmentos literales del cuerpo:

- «El acto comenzará a las 17:30 horas con un espectáculo a cargo de los y las
  artistas de Teatro Musical Artea.»
- «A su finalización, llegará el momento de activar la iluminación de la plaza
  y de la fachada del Ayuntamiento.»
- «Las personas que se acerquen hasta la plaza también podrán disfrutar de una
  degustación de chocolate caliente . Tras el encendido, la celebración
  continuará en la plaza de la Virgen Blanca donde se pondrán en marcha una
  noria de 30 metros y un carrusel.»
- «El Ayuntamiento de Vitoria-Gasteiz va a iluminar más de una treintena de
  calles y  plazas de la ciudad.»
- «La ciudadanía vitoriana, así como las personas que visiten la ciudad en
  estas fechas tan especiales, podrá contemplar un total de 1.100 elementos
  luminosos. Entre ellos y como novedad, un árbol luminoso de 13 metros que
  lucirá en la plaza de España y cuyo montaje ya ha comenzado.»

El espacio doble en «calles y  plazas» está en el texto extraído; se conserva
para no reescribir la fuente.

### 2. Ficha municipal del encendido

URL: https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u_73d895a5_1a205d099cd_232f

HTTP 410 al volver a consultarla el 2026-11-27, pero el cuerpo sigue sirviendo
el texto y el JSON-LD (49.410 bytes). Fragmentos literales:

- «El evento comenzará a las 17:30 y tendrá un marcado carácter musical.
  Reunirá a más de 300 voces con la participación del Teatro Musical Artea y
  de los coros Izartza y Taupada Txiki. El momento central tendrá ugar a las
  18:00, cuando se pulse el botón de encendido, inaugurando así la iluminación
  navideña.» (`ugar` está escrito así en la fuente oficial.)
- «Una vez encendidas las luces, se repartirá chocolate de comercio justo y
  bizcocho para 700 comensales.»

### 3. Nota de prensa municipal, 6 de noviembre de 2026

URL: https://blogs.vitoria-gasteiz.org/medios/2026/11/06/montes-solidarios-encendera-la-navidad-en-vitoria-gasteiz/

HTTP 200 el 2026-11-27 (77.268 bytes). Fragmentos literales:

- «a partir de las 17:30 horas»
- «el encendido de las luces, se producirá a las 18:00 horas»

### 4. Calendario municipal (`calendariosID=566`)

URL: https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet?accion=buscar&idioma=es&calendariosID=566&fd=1795561200000&fh=1799362799000&deCM=false&moEx=false

HTTP 200 el 2026-11-27 (89.646 bytes). `fd` y `fh` tienen que ser epoch en
milisegundos: con fechas en texto la misma consulta devuelve HTTP 400 `Error`.
La única fila de las cuatro categorías del JSON que menciona chocolate, árbol,
luces o encendido es esta, y sus campos literales son:

- `"titulo":"Encendido de las luces de Navidad"`
- `"fechaInicio":"20261126"`
- `"horaInicio":"17:30"`
- `"horaFin":"18:30"`
- `"aproxFin":true`

No hay ninguna fila de `chocolatada`, de `Árbol luminoso` ni de `Luces de
Navidad` como instalación con una hora propia.

### 5. Fuente del repo para Belenes del Carmen

URL: https://blog.euskaltel.com/belenes-vitoria-gasteiz/

HTTP 200 el 2026-11-27 (55.278 bytes). Fragmento literal: «En los próximos días
sabremos las fechas de apertura y los horarios, de momento puedes ver la
información del año pasado». Justo debajo, el horario que se ofrece como
referencia es «Del 19 de diciembre de 2025 al 6 de enero de 2026».

### Contexto no oficial

https://gasteizberri.com/2026/11/vitoria-enciende-hoy-la-navidad-horarios-noria-y-chocolatada/ devuelve HTTP 403 (Cloudflare) con `curl.exe`; el markdown se pudo leer con otra herramienta. No se usa para clasificar ninguna hora.

## Clasificación de los tres eventos

| Evento | Clasificación | ¿Es honesto `POR CONFIRMAR`? | Literal propuesto |
| --- | --- | --- | --- |
| `chocolatada` | `SOLO REFERENCIA RELATIVA` | **No.** Sí hay una referencia publicada. | `Tras el encendido` |
| `arbol` | `SIN HORA PUBLICADA` | Defendible, pero vago: sugiere que hay una hora pendiente de anunciar. | `SIN HORA PUBLICADA` |
| `luces` | `SIN HORA PUBLICADA` | Defendible para la instalación, pero confunde «no publicada» con «por confirmar». | `SIN HORARIO PUBLICADO` |

Ninguno de los tres es `HORA OFICIAL CONCRETA`. La única hora concreta de este
bloque es la del evento `encendido`, que el reel ya muestra bien a las `17:30`.

### `chocolatada`

La nota municipal dice «Tras el encendido» y la ficha dice «Una vez encendidas
las luces, se repartirá chocolate de comercio justo y bizcocho para 700
comensales». Las dos son referencias relativas. El `18:00` oficial es el
momento en que se pulsa el botón, y el `17:30` el comienzo del espectáculo;
ninguno de los dos se publica como hora de la degustación. Escribir `18:00`
aquí sería inventar una hora de inicio que la fuente no da.

Si se acepta el literal `Tras el encendido`, la etiqueta fija «EMPIEZA A LAS»
de `scripts/reel-navidad.ts:116` tendría que cambiar en ese plano (por
«CUÁNDO» o «HORA»), o el resultado se leería «EMPIEZA A LAS Tras el encendido».

### `arbol`

La nota municipal lo describe como novedad, dice que «lucirá en la plaza de
España» y que «su montaje ya ha comenzado». No da hora de encendido,
inauguración ni apertura del árbol. Es una instalación, no un acto con hora de
inicio. No hay referencia relativa que copiar, así que la clase correcta es
`SIN HORA PUBLICADA`, no `SOLO REFERENCIA RELATIVA`.

### `luces`

Aquí conviene no confundir dos cosas que el repo ya separa:

- El evento `encendido` (`lib/navidad-vitoria.ts:99-115`) es el acto del 26 de
  noviembre: `17:30` de comienzo, `18:00` de pulsación del botón, `18:30` de fin
  aproximado en el calendario. Esa es la fila
  `"titulo":"Encendido de las luces de Navidad"` del `CalendarioServlet`.
- El evento `luces` (`lib/navidad-vitoria.ts:146-157`) es la instalación del
  26 de noviembre al 6 de enero: «1.100 elementos luminosos», «más de una
  treintena de calles y plazas». La nota municipal no publica horario diario de
  encendido ni de apagado para esa instalación.

Darle `18:00` a `luces` duplicaría el plano 1 y borraría la distinción entre el
acto y la iluminación permanente. La clase correcta es `SIN HORA PUBLICADA`.

## Relación con «todos los eventos, fechas y hora de inicio»

El guion (`docs/navidad-2026-guion-reel.md:28-29`) promete fecha y hora de
inicio de cada plan «sin usar las del año anterior». Esa promesa se cumple sin
inventar datos siempre que la columna «hora de inicio» admita tres valores: una
hora oficial concreta, una referencia relativa publicada, o una marca explícita
de ausencia. Si se interpreta como «los trece tienen que llevar un número»,
entonces el requisito contradice a las fuentes primarias: cumplirlo exigiría
fabricar horas para `chocolatada`, `arbol`, `luces` y `belenes-carmen`.

`Belenes del Carmen` (`lib/navidad-vitoria.ts:205-215`) está bien como está.
La fuente que el propio repo cita dice «En los próximos días sabremos las
fechas de apertura y los horarios, de momento puedes ver la información del año
pasado», y las fechas que muestra son de 2025. Mantener `POR CONFIRMAR` en
fecha, hora y precio es exactamente la regla «sin fechas ni horas inventadas».
Cambiar los otros tres a horas numéricas y dejar este como está sería además
incoherente: se estaría tratando la falta de dato de dos maneras distintas.

## Recomendación y decisión pendiente

No he cambiado nada. Antes de tocar `lib/navidad-vitoria.ts`,
`lib/navidad-reel.ts`, `scripts/reel-navidad.ts`,
`docs/navidad-2026-guion-reel.md` o de regenerar
`public/navidad-2026/reel.mp4`, conviene preguntar:

1. ¿Se acepta `Tras el encendido` para `chocolatada`, con cambio de etiqueta en
   ese plano? **Recomendación: sí**, y no escribir `18:00`.
2. ¿Se prefiere `SIN HORA PUBLICADA` / `SIN HORARIO PUBLICADO` frente a
   `POR CONFIRMAR` para `arbol` y `luces`? **Recomendación: sí**: son más
   honestos, porque las fuentes no anuncian una hora futura.
3. ¿Se mantiene `POR CONFIRMAR` en `belenes-carmen`? **Recomendación: sí**, sin
   reutilizar las fechas de 2025.

Un detalle de implementación que también necesita decisión: si se sustituyen
los literales, `pendiente` en `lib/navidad-reel.ts:43-45` deja de reconocerlos
porque compara con `POR_CONFIRMAR` por identidad, y el distintivo rojo
desaparecería. Hay que ampliar esa comprobación a los nuevos marcadores o
aceptar que esos planos dejen de llevar el distintivo.

## Verificado

- URLs oficiales consultadas el 2026-11-27 con `fetch`: nota 25-nov `200`,
  nota 6-nov `200`, ficha `410` con cuerpo servido, calendario `200`,
  blog de Belenes `200`. Se buscaron los fragmentos literales citados en el
  cuerpo devuelto, no en una copia local.
- En el JSON del calendario solo aparece una fila con las palabras clave
  `chocolate|chocolatada|árbol|luminoso|luces|encendido`: la del encendido.
- No se ha modificado código, tests, reel ni workflows. Los cambios ya
  presentes en `__tests__/navidad-vitoria.test.ts`,
  `docs/navidad-2026-guion-reel.md`, `public/navidad-2026/reel.mp4` y
  `scripts/reel-navidad.ts` son anteriores a esta investigación.
