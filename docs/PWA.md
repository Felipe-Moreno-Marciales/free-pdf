# Aplicación web progresiva

Free PDF se puede instalar como una aplicación web progresiva (PWA) desde los
navegadores compatibles. La instalación no añade un servidor ni cambia el
tratamiento de los documentos: siguen procesándose localmente y nunca entran en
el service worker ni en la caché.

## Qué se instala

La compilación genera un `service-worker.js` versionado que prepara para uso sin
conexión todos los archivos estáticos de la aplicación:

- la interfaz y los 23 módulos cargados de forma diferida;
- qpdf y su trabajador;
- PDF.js, sus CMaps, tipografías, perfiles de color y WebAssembly;
- Tesseract.js y los modelos locales de español e inglés;
- el manifiesto y los iconos de instalación.

La compilación actual incluye 283 recursos y aproximadamente 23 MiB. El navegador
los guarda en `Cache Storage` después de la primera visita en producción. Esa
caché contiene código y recursos idénticos para todo el mundo; **no contiene PDF,
imágenes, contraseñas, resultados ni preferencias**.

## Instalación y alcance

El manifiesto usa rutas relativas para que `start_url`, `scope` e iconos queden
dentro de `/free-pdf/` en GitHub Pages. Declara:

- nombre corto y completo;
- modo `standalone`;
- iconos PNG de 192 y 512 píxeles;
- un icono de 512 píxeles preparado para máscaras;
- identidad azul `#2196f3`.

El navegador ofrece su propia acción de instalación cuando la plataforma lo
permite. No se añade un botón dependiente de `beforeinstallprompt`, porque no es
una API uniforme entre navegadores.

## Actualizaciones

Cada compilación calcula SHA-256 sobre todos los recursos finales y sobre la
propia política del service worker, y usa los primeros 16 caracteres como
versión de caché. Si cambia cualquier archivo o la estrategia:

1. se instala una caché nueva de forma atómica;
2. el service worker anterior continúa atendiendo las pestañas abiertas;
3. la versión nueva se activa cuando ya no quedan clientes de la anterior;
4. al activarse, elimina únicamente las cachés antiguas cuyo nombre empieza por
   `free-pdf-`.

No se usa `skipWaiting`: activarlo podría mezclar una página antigua con módulos
nuevos durante una operación en curso.

## Verificación

`src/pruebas/pwa.prueba.ts` comprueba los campos de instalación, la firma y las
medidas reales de los iconos, el precaché de motores locales y la política de
actualización. `pnpm build` enumera el total y el tamaño de los recursos que el
service worker prepara para uso sin conexión.
