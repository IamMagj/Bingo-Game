# 📱 Cómo convertir Bingo 3D en una app publicable (App Store / Google Play)

Este documento explica, con honestidad, qué hace falta para que tu familia pueda jugar
desde una app instalada del móvil — y qué camino conviene según cuánta prisa tengas.

## 🗺️ Resumen de las dos opciones

| | **Opción rápida: PWA** | **Opción completa: App nativa (Capacitor)** |
|---|---|---|
| Tiempo | Minutos | Días/semanas (cuentas, revisión) |
| Coste | Gratis | Apple: 99 $/año · Google: 25 $ único |
| Dónde se instala | "Añadir a pantalla de inicio" desde el navegador | App Store / Google Play, como cualquier app |
| Necesitas Mac | No | Sí, para compilar la versión iOS (Xcode) |
| Revisión de terceros | No | Sí (Apple/Google revisan la app) |
| Ideal para | Jugar YA con la familia | Publicarla "en serio" en el futuro |

Te recomiendo **jugar ya con la opción PWA** (abajo) mientras preparas con calma la
publicación nativa, ya que el código que te generé ya está listo para ambos caminos.

---

## 🔑 Lo primero, sea cual sea el camino: el servidor debe estar publicado en internet

Ahora mismo el servidor solo corre en tu ordenador (`localhost:3000`). Para que cualquier
familiar —esté donde esté, no solo en tu wifi— pueda jugar, necesitas subir el servidor a
un hosting con URL pública y **HTTPS** (obligatorio para apps nativas y recomendable para
todo). No necesitas nada carísimo; con la capa gratuita de estos servicios es suficiente
para jugar en familia:

- **Render.com** (recomendado, capa gratuita, fácil): crea un cuenta → "New Web Service" →
  conecta tu repositorio (o sube el ZIP a GitHub primero) → Build Command: `npm install` →
  Start Command: `npm start` → Render te da una URL como `https://tu-bingo.onrender.com`.
- **Railway.app**: proceso muy similar, también con capa gratuita/de bajo coste.
- **Fly.io**: algo más técnico pero también válido, con `fly deploy`.
- Alternativa: un VPS propio (DigitalOcean, etc.) con Node.js + Nginx como proxy HTTPS.

> ⚠️ Nota: estos servicios gratuitos a veces "duermen" el servidor tras un rato de
> inactividad y tardan unos segundos en despertar con la primera conexión — normal, no es
> un error.

Una vez tengas la URL pública, edita **una sola línea** en tu proyecto:

```js
// public/js/config.js
export const SERVER_URL = 'https://tu-bingo.onrender.com'; // tu URL real aquí
```

Con esto, tanto la versión web como la app nativa se conectarán siempre a tu servidor,
estés donde estés.

---

## ⚡ Opción rápida: jugar hoy mismo como "app" (PWA)

1. Despliega el servidor como se explica arriba (o dilo a tu familia que usen tu IP local
   si todos estáis en la misma wifi, como ya funcionaba).
2. Cada familiar abre la URL en el navegador del móvil (Chrome en Android, Safari en iPhone).
3. Pulsa el menú del navegador → **"Añadir a pantalla de inicio"**.
4. Se crea un icono en el escritorio del móvil que abre el juego a pantalla completa,
   como una app normal — sin pasar por ninguna tienda ni revisión.

Esto ya te sirve para jugar en familia sin esperar nada. Cuando quieras dar el salto a
tienda oficial, sigue la siguiente sección.

---

## 🏗️ Opción completa: empaquetar con Capacitor y publicar en las tiendas

Ya he preparado el proyecto para esto: añadí `capacitor.config.json`, las dependencias de
Capacitor en `package.json`, y `public/js/config.js` para apuntar al servidor real.

### 1. Requisitos previos

- Node.js instalado (ya lo tienes).
- **Para iOS**: un Mac con Xcode instalado, y una cuenta de **Apple Developer Program**
  (99 $/año) — es obligatoria para subir cualquier app a la App Store.
- **Para Android**: Android Studio, y una cuenta de **Google Play Console** (25 $, pago
  único).

### 2. Instalar Capacitor y generar los proyectos nativos

```bash
cd bingo3d
npm install
npx cap init "Bingo 3D" com.tufamilia.bingo3d --web-dir=public
```

(El `cap init` puede que ya no haga falta si usas el `capacitor.config.json` incluido;
si te pregunta si sobrescribir, dile que sí.)

```bash
npm run cap:add:ios       # genera la carpeta /ios (proyecto Xcode)
npm run cap:add:android   # genera la carpeta /android (proyecto Android Studio)
npm run cap:sync          # copia public/ dentro de los proyectos nativos
```

### 3. Abrir y compilar

```bash
npm run cap:open:ios       # abre Xcode
npm run cap:open:android   # abre Android Studio
```

Desde ahí, compilas/ejecutas igual que cualquier app nativa: en un simulador, en tu propio
móvil (modo desarrollador), o generas el `.ipa`/`.aab` para subir a la tienda.

> Recuerda: cada vez que cambies algo en `public/`, vuelve a ejecutar `npm run cap:sync`
> para que se refleje en los proyectos nativos antes de compilar.

### 4. Cosas que pedirán las tiendas (y que aún faltan)

- **Icono de la app**: necesitas una imagen de 1024x1024 px. Con ella, la herramienta
  `@capacitor/assets` genera automáticamente todos los tamaños necesarios:
  ```bash
  npm install @capacitor/assets --save-dev
  npx capacitor-assets generate
  ```
- **Splash screen** (pantalla de carga): la misma herramienta la genera a partir de un
  logo simple.
- **Capturas de pantalla** de la app en varios tamaños de dispositivo (se piden al subir
  la ficha en App Store Connect / Play Console).
- **Política de privacidad** (obligatoria en ambas tiendas, incluso si no guardas datos
  personales): puede ser una sola página web indicando que el juego no recopila datos
  personales, no usa cuentas ni pagos, y que los nombres de jugador solo existen
  temporalmente durante la partida en memoria del servidor.
- **Descripción clara de que es un juego sin dinero real**: al ser un "bingo", tanto Apple
  como Google revisan con atención cualquier posibilidad de apuestas. Como este juego no
  usa dinero real ni premios canjeables, debes indicarlo explícitamente en la descripción
  de la ficha de la tienda para evitar rechazos en la revisión (categoría: "Juegos" /
  "Entretenimiento familiar", no "Casino").

### 5. Consideraciones sobre el servidor en producción

- Cambia `cors: { origin: '*' }` en `server.js` por el dominio real de tu app si quieres
  más seguridad (opcional, no imprescindible para uso familiar).
- El estado de las salas vive en memoria del servidor: si el hosting gratuito reinicia el
  proceso, las partidas en curso se perderían (aceptable para uso familiar informal).
- Si vais a ser muchos jugando a la vez de forma recurrente, un plan de pago pequeño en
  Render/Railway evita los "reinicios por inactividad".

---

## ✅ Resumen práctico

1. Hoy: despliega el servidor gratis (Render), pon la URL en `config.js`, y usad "Añadir a
   pantalla de inicio" — ya jugáis todos como si fuera una app.
2. Cuando quieras la app "de verdad" en las tiendas: instala Capacitor con los comandos de
   arriba, genera icono/splash, escribe una política de privacidad sencilla, y sigue el
   proceso normal de Apple Developer Program / Google Play Console para subir la app.

El código del juego (servidor y cliente) no necesita ningún otro cambio: ya está preparado
para ambos caminos.
