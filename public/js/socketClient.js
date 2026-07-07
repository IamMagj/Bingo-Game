import { emit, state } from './state.js';
import { SERVER_URL } from './config.js';

// Si SERVER_URL está vacío, se conecta al mismo host que sirvió la página
// (ideal para desarrollo local / red local). Si se define (necesario para
// apps nativas empaquetadas con Capacitor), se conecta a esa URL pública.
export const socket = SERVER_URL ? io(SERVER_URL) : io();

socket.on('connect', () => {
  state.myId = socket.id;
});

socket.on('room:created', (data) => {
  state.roomCode = data.roomCode;
  state.myId = data.playerId;
  state.isCreator = data.creatorId === data.playerId;
  state.settings = data.settings;
  state.players = data.players;
  emit('room:entered', data);
});

socket.on('room:joined', (data) => {
  state.roomCode = data.roomCode;
  state.myId = data.playerId;
  state.isCreator = data.creatorId === data.playerId;
  state.settings = data.settings;
  state.players = data.players;
  emit('room:entered', data);
});

socket.on('room:error', (data) => emit('room:error', data));

socket.on('players:update', (data) => {
  state.players = data.players;
  state.isCreator = data.creatorId === state.myId;
  emit('players:update', data);
});

socket.on('cards:bought', (data) => {
  state.myCards = state.myCards.concat(data.cards);
  state.currentCardIndex = 0;
  emit('cards:bought', data);
});

socket.on('rival:cardsUpdate', (data) => {
  const existing = state.players.find((p) => p.id === data.playerId);
  state.rivalCards.set(data.playerId, { name: existing ? existing.name : '?', cards: data.cards });
  emit('rival:update');
});

socket.on('game:started', (data) => {
  state.gameStarted = true;
  state.gameOver = false;
  state.settings = data.settings;
  state.players = data.players;
  if (data.rivalCards) {
    data.rivalCards.forEach((r) => state.rivalCards.set(r.playerId, { name: r.name, cards: r.cards }));
  }
  emit('game:started', data);
});

socket.on('draw:mixing', () => emit('draw:mixing'));

socket.on('draw:number', (data) => {
  state.extracted = data.extracted;
  state.lastNumber = data.number;
  emit('draw:number', data);
});

socket.on('draw:poolEmpty', () => emit('draw:poolEmpty'));
socket.on('draw:autoStatus', (data) => {
  state.autoplayActive = data.active;
  emit('draw:autoStatus', data);
});

socket.on('win:available', (data) => emit('win:available', data));
socket.on('win:lineClaimed', (data) => emit('win:lineClaimed', data));

socket.on('game:over', (data) => {
  state.gameOver = true;
  emit('game:over', data);
});

// ---------- Acciones que el cliente envía al servidor ----------

export function createRoom(settings, playerName) {
  socket.emit('room:create', { settings, playerName });
}

export function joinRoom(roomCode, playerName) {
  socket.emit('room:join', { roomCode, playerName });
}

export function buyCards(count) {
  socket.emit('cards:buy', { roomCode: state.roomCode, count });
}

export function setMyOptions(options) {
  socket.emit('player:setOptions', { roomCode: state.roomCode, options });
}

export function startGame() {
  socket.emit('game:start', { roomCode: state.roomCode });
}

export function drawManual() {
  socket.emit('draw:manual', { roomCode: state.roomCode });
}

export function autoStart(intervalSec) {
  socket.emit('draw:autoStart', { roomCode: state.roomCode, intervalSec });
}

export function autoStop() {
  socket.emit('draw:autoStop', { roomCode: state.roomCode });
}

export function markNumber(cardId, number) {
  socket.emit('mark:number', { roomCode: state.roomCode, cardId, number });
}

export function claimWin(cardId) {
  socket.emit('win:claim', { roomCode: state.roomCode, cardId });
}

export function leaveRoom() {
  socket.emit('room:leave');
}
