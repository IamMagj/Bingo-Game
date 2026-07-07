// Punto de entrada: importar ui.js registra todos los listeners de la interfaz
// y las respuestas a los eventos del socket (ver socketClient.js y state.js).
import './ui.js';

// Desbloquear el audio del navegador tras la primera interacción del usuario
// (requisito de la mayoría de navegadores para permitir sonido).
document.addEventListener('click', function unlock() {
  document.removeEventListener('click', unlock);
}, { once: true });
