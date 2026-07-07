// ============================================================================
// CONFIGURACIÓN DE CONEXIÓN AL SERVIDOR
// ============================================================================
// Cuando abres el juego en un navegador normal (http://localhost:3000 o por IP
// de red local), el cliente puede conectarse automáticamente "al mismo sitio
// que sirvió la página" y esto puedes dejarlo vacío ('').
//
// Cuando empaquetes el juego como app nativa (Capacitor/iOS/Android), la app
// ya NO se sirve desde tu servidor Node: se instala en el teléfono y se
// carga desde un origen local (capacitor://, ionic://, etc). En ese caso
// DEBES indicar aquí la URL pública (con HTTPS) de tu servidor ya desplegado,
// por ejemplo:
//
//   export const SERVER_URL = 'https://mi-bingo.onrender.com';
//
// Deja SERVER_URL = '' mientras desarrolles/pruebes en local o en red local.
// ============================================================================

export const SERVER_URL = '';
