// Estado global del cliente y un pequeño "event bus" para comunicar los módulos
// (socketClient.js, ui.js, cage3d.js) sin acoplarlos directamente entre sí.

export const bus = new EventTarget();

export function emit(name, detail) {
  bus.dispatchEvent(new CustomEvent(name, { detail }));
}

export function on(name, handler) {
  bus.addEventListener(name, (e) => handler(e.detail));
}

export const state = {
  myId: null,
  roomCode: null,
  isCreator: false,
  settings: null,
  players: [],
  myCards: [],           // [{id, numbers, marked}]
  currentCardIndex: 0,
  extracted: [],         // números ya extraídos, en orden de salida
  lastNumber: null,
  rivalCards: new Map(), // playerId -> { name, cards }
  gameStarted: false,
  gameOver: false,
  autoplayActive: false
};
