# 🎱 Bingo 3D Multijugador

Juego de Bingo de 90 bolas en 3D, multijugador y en tiempo real, con un bombo giratorio
renderizado con **Three.js**, backend en **Node.js + Express + Socket.io**, y una interfaz
oscura y moderna.

---

## ✨ Características

- **Bombo 3D interactivo**: esfera de cristal o jaula metálica (a elegir), con las 90 bolas
  numeradas dentro. Arrastra para rotar, rueda del ratón para hacer zoom.
- **Animación de extracción**: al pulsar "Extraer número" las bolas se agitan y luego una
  bola sale disparada hacia la cámara.
- **Cartones 3x9 únicos**: cada jugador puede comprar de 1 a 100 cartones, generados
  aleatoriamente sin duplicados, navegables con flechas.
- **Marcado automático o manual**, configurable por sala (o por jugador si el creador lo permite).
- **Modos de victoria**: Solo Línea, Solo Bingo, o Línea + Bingo (la línea se puede reclamar
  una vez y la partida continúa hasta el Bingo).
- **Salas multijugador** con código de 6 caracteres. Solo el creador de la sala puede girar
  el bombo. Si el creador se desconecta, el siguiente jugador pasa a ser el nuevo creador
  automáticamente.
- **Cartones rivales visibles** (si el creador lo activa).
- **Sonidos** generados con Web Audio API (sin archivos externos).
- **Diseño responsive** oscuro (`#1a1a2e` de fondo, acentos `#e94560`).

---

## 📁 Estructura del proyecto

```
bingo3d/
├── package.json
├── server.js                  # Servidor Express + Socket.io
├── server/
│   ├── roomManager.js         # Lógica de salas, jugadores, extracción, victorias
│   └── cardGenerator.js       # Generación de cartones 3x9 únicos
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── main.js            # Punto de entrada del cliente
│       ├── ui.js              # Lógica de interfaz y pantallas
│       ├── socketClient.js    # Comunicación con el servidor
│       ├── cage3d.js          # Escena 3D (Three.js) del bombo
│       ├── state.js           # Estado compartido + bus de eventos
│       └── sound.js           # Efectos de sonido (Web Audio API)
└── README.md
```

---

## 🚀 Instalación y ejecución

### Requisitos

- [Node.js](https://nodejs.org/) versión 16 o superior (incluye `npm`).

### Pasos

1. **Descarga o extrae** el proyecto en una carpeta, por ejemplo `bingo3d/`.

2. Abre una terminal (o PowerShell/CMD en Windows) y entra en la carpeta del proyecto:

   ```bash
   cd ruta/a/bingo3d
   ```

3. Instala las dependencias:

   ```bash
   npm install
   ```

4. Inicia el servidor:

   ```bash
   npm start
   ```

5. Verás en la consola algo como:

   ```
   🎱 Bingo 3D corriendo en http://localhost:3000
   ```

6. Abre tu navegador en **http://localhost:3000**

7. Para probar el modo multijugador desde el mismo ordenador, abre varias pestañas o
   ventanas del navegador apuntando a la misma URL: cada pestaña actúa como un jugador
   distinto (identificado por su `socket.id`).

8. Para jugar entre varios dispositivos en la misma red local (por ejemplo, con el móvil),
   averigua la IP local del ordenador que ejecuta el servidor:
   - Windows: `ipconfig` (busca "Dirección IPv4")
   - macOS/Linux: `ifconfig` o `ip addr`

   Y accede desde los otros dispositivos a `http://TU_IP_LOCAL:3000` (por ejemplo,
   `http://192.168.1.35:3000`). Asegúrate de que el firewall permite conexiones en el
   puerto 3000.

---

## 🎮 Cómo jugar

1. En la pantalla inicial, **crea una sala** (elige nombre y las opciones de la partida:
   modo de victoria, marcado automático, ver cartones rivales, forma del bombo, etc.),
   o **únete** a una sala existente con el código de 6 caracteres que te compartan.
2. En la sala de espera, cada jugador **compra sus cartones** (de 1 a 100).
3. Una vez todos tengan sus cartones, el **creador de la sala pulsa "Iniciar partida"**.
4. Solo el creador puede pulsar **"Extraer número"** (extracción manual, una bola cada vez)
   o activar **"Auto-jugar"** (extrae automáticamente cada 2-8 segundos, configurable).
5. Marca tus números —automáticamente si esa opción está activada, o haciendo clic en el
   cartón si el marcado es manual—.
6. Cuando completes una línea o el cartón entero (bingo), aparecerá el botón
   **"¡Reclamar premio!"**. Púlsalo antes que nadie más para ganar esa ronda.

---

## 🛠️ Solución de problemas (Windows / PowerShell)

Si al ejecutar `npm install` o `npm start` en PowerShell ves un error similar a:

```
no se puede cargar el archivo ...\npm.ps1 porque la ejecución de scripts está deshabilitada en este sistema
```

Esto ocurre porque la política de ejecución de scripts de PowerShell bloquea los scripts
de `npm` por defecto. Tienes dos soluciones:

**Opción A (recomendada): usa el Símbolo del sistema (CMD) en lugar de PowerShell**
Abre "cmd.exe" y ejecuta ahí `npm install` y `npm start` con normalidad.

**Opción B: permite scripts en PowerShell (para el usuario actual)**
Abre PowerShell **como administrador** y ejecuta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

Confirma con `S` (Sí) y vuelve a intentar `npm install` / `npm start`.

### Otros problemas comunes

- **"El puerto 3000 ya está en uso"**: cierra la otra aplicación que lo usa, o arranca el
  servidor en otro puerto: `set PORT=3001 && npm start` (CMD) o
  `$env:PORT=3001; npm start` (PowerShell), y abre luego `http://localhost:3001`.
- **No veo el bombo 3D / pantalla negra**: asegúrate de tener actualizada tu tarjeta
  gráfica/navegador (se recomienda Chrome, Edge o Firefox recientes) y que WebGL esté
  habilitado.
- **No puedo unirme desde el móvil**: comprueba que el móvil está en la misma red Wi-Fi
  que el ordenador servidor y que el firewall de Windows no bloquea el puerto 3000
  (puedes crear una regla de entrada para Node.js/puerto 3000 en "Firewall de Windows
  Defender").

---

## 🧱 Arquitectura técnica

- **Servidor** (`server.js`, `server/roomManager.js`, `server/cardGenerator.js`): mantiene
  el estado autoritativo de cada sala (jugadores, cartones, números restantes/extraídos,
  marcado, condición de victoria) y sincroniza a todos los clientes vía Socket.io. La
  generación de cartones sigue el formato clásico de bingo de 90 bolas (9 columnas por
  rango de decena, 3 filas, 5 números por fila) y garantiza unicidad dentro de cada sala.
- **Cliente**: módulos ES (`type="module"`) separados por responsabilidad:
  - `state.js`: estado compartido + bus de eventos interno (evita acoplar los módulos).
  - `socketClient.js`: única puerta de entrada/salida de eventos Socket.io.
  - `cage3d.js`: escena Three.js (bombo, bolas, mezcla, extracción, `OrbitControls`,
    etiquetas con `CSS2DRenderer`).
  - `ui.js`: pantallas, formularios, renderizado de cartones/tablero/historial.
  - `sound.js`: efectos de sonido sintetizados con Web Audio API.

### Preparado para empaquetar como app de escritorio/móvil

La arquitectura (frontend estático + servidor Node/Socket.io independiente) permite
envolver el cliente fácilmente:

- **Electron**: crea una `BrowserWindow` que cargue `http://localhost:3000` (lanzando el
  servidor Node como proceso hijo, o embebiéndolo en el proceso principal de Electron).
- **Capacitor**: copia la carpeta `public/` como `www/` de un proyecto Capacitor y apunta
  el cliente al servidor mediante la IP pública/local (ajustando la URL de conexión de
  Socket.io en `public/js/socketClient.js`, que por defecto se conecta al mismo host que
  sirvió la página).

No es necesario ningún cambio estructural: el servidor ya sirve todo desde `public/` y el
socket se conecta automáticamente al host desde el que se cargó la página.

---

¡Disfruta la partida! 🎉
