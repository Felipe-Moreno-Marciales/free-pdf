# Cifrado de documentos en Free PDF

Este documento explica cómo se cifran y descifran los PDF, qué protege de verdad y qué no.

## Por qué no se usa pdf-lib

pdf-lib es excelente para crear y modificar documentos, pero **no sabe cifrar ni descifrar**. Existe la tentación de usar su opción `ignoreEncryption: true` para «abrir» un documento protegido: no hay que hacerlo. Esa opción no descifra nada; se limita a saltarse la comprobación, y lo que se obtiene al guardar es un archivo con los flujos todavía cifrados y un diccionario incoherente, es decir, un documento inservible.

Por eso el cifrado se delega en un motor que sí sabe hacerlo.

## qpdf compilado a WebAssembly

Se usa [qpdf](https://github.com/qpdf/qpdf) **12.2.0**, a través del paquete [`@neslinesli93/qpdf-wasm`](https://github.com/neslinesli93/qpdf-wasm) 0.3.0.

### Por qué este paquete

Antes de integrarlo se auditó:

| Comprobación | Resultado |
| ------------ | --------- |
| Licencia | ISC, compatible con AGPL-3.0 |
| Mantenimiento | Publicado en junio de 2025; contiene qpdf 12.2.0 |
| Dependencias | Ninguna |
| Telemetría | Ninguna. El pegamento no contiene ninguna URL codificada |
| Cómo carga el WASM | `fetch(url, { credentials: 'same-origin' })`, con `locateFile` bajo nuestro control |
| Compatible con Web Worker | Sí: todas las referencias a `document` y `window` están protegidas con `typeof` y hay respaldo a `self.location.href` |
| Sistema de archivos virtual | Expone `writeFile`, `readFile` y `unlink`, así que se puede limpiar |
| Tipos TypeScript | Incompletos: el `.d.ts` no declara `writeFile` ni `unlink`, así que la aplicación declara los suyos |
| Tamaño | 1,33 MB el WASM, 43 KB el pegamento |

Además se comprobó **ejecutando el motor de verdad** que cifra con AES-256, que la contraseña incorrecta falla, que la correcta descifra y que el sistema de archivos virtual se puede limpiar. Esas comprobaciones no se quedaron en una sesión manual: son las pruebas de [`src/pruebas/motorQpdf.prueba.ts`](../src/pruebas/motorQpdf.prueba.ts), que ejecutan el WebAssembly real en cada validación.

### Dónde se ejecuta

qpdf corre en un **Web Worker** ([`src/seguridad/qpdf/trabajadorQpdf.ts`](../src/seguridad/qpdf/trabajadorQpdf.ts)), no en el hilo principal. Eso aporta tres cosas:

1. La interfaz no se congela mientras se cifra.
2. El documento y la contraseña viven en un contexto aparte.
3. Al destruir el trabajador, **todo** lo que hubiera dentro desaparece con él.

El WASM se importa con `?url`, así que Vite lo copia a `dist/assets/`, le pone una huella en el nombre y le aplica la ruta base. La dirección resultante es del tipo:

```
/free-pdf/assets/qpdf-C3Giu3T4.wasm
```

Es una petición **del mismo origen** que no contiene ningún dato: es el motor, idéntico para todo el mundo. No se usa ninguna CDN. La compilación lo verifica.

### Los módulos de Node no se usan en el navegador

Al compilar, Vite avisa de que el pegamento de qpdf importa `fs`, `path` y `crypto`. Se revisó el código y esas importaciones están **protegidas en tiempo de ejecución**:

```js
if (fa) { var fs = require("fs"); require("path"); … }
```

`fa` es la detección de Node —comprueba `process.versions.node`—, así que en el navegador vale `false` y esas rutas nunca se ejecutan. Vite las sustituye por stubs que jamás se llegan a llamar.

El caso de `crypto` es el más interesante, porque revela de dónde sale la aleatoriedad:

```js
if ("object" == typeof crypto && "function" == typeof crypto.getRandomValues)
  return c => crypto.getRandomValues(c);
if (fa) try { var a = require("crypto"); … }
```

Es decir, **en el navegador qpdf usa `crypto.getRandomValues`**, la API criptográfica del propio navegador, y solo recurre al módulo de Node cuando se ejecuta en Node. La aleatoriedad del cifrado —y la de la contraseña de propietario que genera la aplicación— viene por tanto de una fuente criptográficamente segura.

## AES de 256 bits

Es el único cifrado que se ofrece:

```
--encrypt --user-password=… --owner-password=… --bits=256 … --
```

- **No se ofrece RC4** ni claves de 40 o 128 bits. No aportan protección real hoy.
- **No se usa `--allow-insecure`**, que permitiría dejar el documento abriéndose sin contraseña.
- El resultado declara revisión 6 y método `AESv3`, y así se verifica antes de entregarlo.

## Contraseña de apertura y de propietario

El formato PDF distingue dos contraseñas:

- La **contraseña de apertura** (o de usuario) es la que cifra. Sin ella el contenido no se puede leer: esto es protección criptográfica de verdad.
- La **contraseña de propietario** es la que permite cambiar los permisos. Quien la tenga puede quitar las restricciones.

### La contraseña de propietario no puede quedar vacía

qpdf **se niega** a cifrar con 256 bits si la contraseña de propietario está vacía, y con razón: un documento así se puede abrir sin contraseña. El mensaje es explícito:

> A PDF with a non-empty user password and an empty owner password encrypted with a 256-bit key is insecure as it can be opened without a password.

La salida fácil sería `--allow-insecure`. No se hace. En su lugar, cuando no se indica una contraseña de propietario **se genera una aleatoria** de 32 bytes con `crypto.getRandomValues`, la API criptográfica del navegador:

```ts
export function generarContrasenaPropietario(): string
```

Esa contraseña no se muestra ni se guarda. Su única función es que el diccionario de permisos quede protegido. Quien conozca la contraseña de apertura podrá abrir y leer el documento, que es lo que se pretende; lo que no podrá es cambiar los permisos, y eso es exactamente lo que significa una contraseña de propietario.

Si se prefiere elegirla, la herramienta lo permite, y entonces exige que sea **distinta** de la de apertura: si fueran iguales, los permisos no protegerían nada.

## Permisos

Se declaran de forma **granular**, sin usar el atajo `--modify`, que fija varios a la vez y podría contradecir los indicados aparte:

```
--print=full|low|none
--extract=y|n
--accessibility=y|n
--annotate=y|n
--form=y|n
--assemble=y|n
--modify-other=y|n
```

### Los permisos no son una barrera técnica

Conviene entenderlo bien: los permisos son una **declaración** que cada lector PDF decide respetar o no. Un lector puede ignorarlos por completo. Lo único que protege de verdad es la contraseña de apertura, porque cifra el contenido.

La interfaz lo dice con esas palabras, no en una nota al pie.

### La accesibilidad se permite siempre

Con AES-256 el bit de «extracción para accesibilidad» **desapareció de la especificación PDF**. qpdf lo ignora y avisa:

> -accessibility=n is ignored for modern encryption formats

Como el control no tendría ningún efecto, **no se ofrece**: mostrar una casilla que no hace nada sería engañoso. La interfaz explica que la extracción para tecnología asistiva se permite siempre, lo que además es lo correcto para quien usa un lector de pantalla.

## Verificación antes de entregar

Ni proteger ni desbloquear entregan un archivo sin comprobarlo antes.

Al **proteger**, dentro del trabajador:

1. Se comprueba que el documento de partida no estuviera ya cifrado.
2. Se cifra.
3. Se pide el informe con `--show-encryption` y debe declarar revisión 6 y `AESv3`.
4. Se descifra con la contraseña indicada, que debe funcionar.
5. Se comprueba que el resultado descifrado ya no declara cifrado.

Y en el hilo principal, que el número de páginas coincide con el del original.

Al **desbloquear**:

1. Se descifra con `--password-file`.
2. Se comprueba que el resultado ya no declara cifrado.
3. Se abre con pdf-lib, sin `ignoreEncryption`, y debe conservar alguna página.

**Si alguna comprobación falla, no se descarga nada.** Es preferible un error claro a un archivo que parezca correcto y no lo esté.

## Cómo se tratan las contraseñas

### Al descifrar: fuera de los argumentos

qpdf admite `--password-file=RUTA`, que lee la contraseña de un archivo. Se aprovecha: la contraseña se escribe en el sistema de archivos virtual, se pasa **solo la ruta** y el archivo se borra en cuanto qpdf ha terminado. Así ni un mensaje de uso de qpdf podría llegar a mostrarla.

```
--password-file=/clave --decrypt /entrada.pdf /salida.pdf
```

### Al cifrar: dentro de los argumentos, y por qué

Aquí hay una limitación real que conviene declarar: **qpdf no admite leer de un archivo las contraseñas con las que va a cifrar.** `--password-file` solo existe para *abrir* un documento ya cifrado. Al cifrar hay que usar `--user-password=…` y `--owner-password=…`, así que la contraseña sí viaja en los argumentos.

Eso ocurre **dentro del trabajador**, en memoria. Las medidas que lo acompañan:

- Los argumentos no se registran nunca, ni completos ni en parte.
- La consola se intercepta **antes** de evaluar el módulo de qpdf (ver más abajo), así que nada de lo que escriba llega a la consola del navegador.
- Los mensajes se recogen con un presupuesto fijo y se redactan antes de salir
  del trabajador. El marcador se elige de forma que no pueda contener ninguna
  de las contraseñas de la operación. Es una red de seguridad: se comprobó que
  qpdf no las imprime, pero se depura de todos modos por si una versión futura
  cambiara.

### La interceptación de la consola

Este detalle importa. El pegamento del paquete hace, al evaluarse:

```js
var oa = console.log.bind(console), r = console.error.bind(console);
```

Es decir, **fija la salida de qpdf a la consola en el momento de cargarse** e ignora las opciones `print` y `printErr`. Si no se hiciera nada, los mensajes de qpdf —incluidos los de error— aparecerían en la consola del navegador.

El trabajador instala su interceptación **antes** de la importación dinámica del módulo, que es lo único que funciona:

```ts
interceptarConsola()          // primero
await import('@neslinesli93/qpdf-wasm')   // después
```

Las pruebas del motor real comprueban que la interceptación captura de verdad la salida.

### Nada persiste

- Las contraseñas viven en el estado de React **solo mientras se usan**. Se borran en cuanto la operación termina, con éxito o con error, y también al restablecer o al cambiar de documento.
- No se guardan en `localStorage`, `sessionStorage`, `IndexedDB` ni cookies.
- No aparecen en nombres de archivo: las rutas del sistema virtual son fijas (`/entrada.pdf`, `/salida.pdf`, `/clave`).
- No se envían a ningún servidor, porque no hay ninguno.

Una limitación honesta: las cadenas de JavaScript son inmutables, así que **no se pueden sobrescribir en memoria**. Lo máximo que se puede hacer es dejar de referenciarlas para que el recolector de basura las reclame, y eso es lo que se hace. Quien necesite garantías más fuertes que eso no debería usar un navegador.

## Limpieza del sistema de archivos virtual

- Se crea una **instancia nueva del motor por operación**, así que cada una arranca con el sistema de archivos vacío. Las pruebas lo verifican.
- Cada archivo que se escribe se borra con `unlink` en un bloque `finally`, también cuando la operación falla. El archivo de contraseña no sobrevive a la operación bajo ninguna circunstancia.
- Al salir de la herramienta se llama a `terminate()` sobre el trabajador: el hilo, el WebAssembly y toda su memoria desaparecen.

## Qué no hace esta herramienta

- **No permite saltarse una contraseña que no se conoce.** Descifrar exige la contraseña correcta. No hay fuerza bruta, no hay diccionarios y no se va a añadir.
- **No firma digitalmente.** El cifrado protege el contenido; no dice nada sobre quién creó el documento.
- **No garantiza que un lector respete los permisos.** Solo la contraseña de apertura protege de verdad.
- **No protege de quien ya conoce la contraseña.**

## Rendimiento

- El WASM son 1,33 MB. La PWA lo prepara durante su precaché para que Proteger y
  Desbloquear funcionen sin conexión; sigue cargándose y ejecutándose de forma
  diferida únicamente al abrir una herramienta que usa qpdf.
- Se comparte una única infraestructura entre las dos herramientas.
- Crear una instancia nueva por operación cuesta volver a compilar el WASM, que el navegador tiene en caché. Se acepta ese coste a cambio del aislamiento: es preferible a reutilizar una instancia que pudiera conservar restos.
- El documento se **transfiere** al trabajador en lugar de copiarse, así que un PDF grande no se duplica en memoria.
