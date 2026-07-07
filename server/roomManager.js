'use strict';

const { generateUniqueCards, serializeCard } = require('./cardGenerator');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1 para evitar confusiones

function makeCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

class Room {
  constructor(code, settings, hostId, hostName) {
    this.code = code;
    this.settings = {
      winMode: settings.winMode || 'both', // 'line' | 'bingo' | 'both'
      autoMark: settings.autoMark !== false,
      showRivalCards: !!settings.showRivalCards,
      allowIndividualOptions: !!settings.allowIndividualOptions,
      cageStyle: settings.cageStyle === 'cage' ? 'cage' : 'sphere'
    };
    this.creatorId = hostId;
    this.players = new Map(); // id -> player
    this.cardSerials = new Set(); // unicidad global de cartones en la sala
    this.pool = [];
    this.extracted = [];
    this.started = false;
    this.gameOver = false;
    this.winner = null;
    this.lineWinner = null;
    this.bingoWinner = null;
    this.autoplay = null; // { intervalId, seconds }

    this.addPlayer(hostId, hostName, true);
  }

  addPlayer(id, name, isCreator = false) {
    this.players.set(id, {
      id,
      name: (name || 'Jugador').slice(0, 24),
      isCreator,
      cards: [],
      options: { autoMark: this.settings.autoMark }
    });
  }

  removePlayer(id) {
    this.players.delete(id);
    if (this.creatorId === id) {
      const next = this.players.values().next().value;
      this.creatorId = next ? next.id : null;
      if (next) next.isCreator = true;
    }
    return this.creatorId;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  publicPlayers() {
    return Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isCreator: p.id === this.creatorId,
      cardCount: p.cards.length,
      options: p.options
    }));
  }

  buyCards(playerId, count) {
    const player = this.players.get(playerId);
    if (!player) throw new Error('Jugador no encontrado');
    if (this.started) throw new Error('La partida ya ha comenzado, no se pueden comprar más cartones');
    const n = Math.max(1, Math.min(100, Math.floor(count)));
    const numbersList = generateUniqueCards(n, this.cardSerials);
    const cards = numbersList.map((numbers, idx) => ({
      id: `${playerId}-${Date.now()}-${idx}`,
      numbers,
      marked: [
        new Array(9).fill(false),
        new Array(9).fill(false),
        new Array(9).fill(false)
      ]
    }));
    player.cards = player.cards.concat(cards);
    return player.cards;
  }

  startGame() {
    if (this.players.values().next().value === undefined) throw new Error('No hay jugadores');
    this.started = true;
    this.gameOver = false;
    this.winner = null;
    this.extracted = [];
    this.pool = [];
    for (let n = 1; n <= 90; n++) this.pool.push(n);
    for (let i = this.pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.pool[i], this.pool[j]] = [this.pool[j], this.pool[i]];
    }
  }

  drawNumber() {
    if (!this.started || this.gameOver) return null;
    if (this.pool.length === 0) return null;
    const number = this.pool.pop();
    this.extracted.push(number);

    // Auto-marcado para quien lo tenga activado
    for (const player of this.players.values()) {
      if (player.options.autoMark) {
        for (const card of player.cards) {
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 9; c++) {
              if (card.numbers[r][c] === number) card.marked[r][c] = true;
            }
          }
        }
      }
    }
    return number;
  }

  markNumber(playerId, cardId, number) {
    if (!this.extracted.includes(number)) return false;
    const player = this.players.get(playerId);
    if (!player) return false;
    const card = player.cards.find((c) => c.id === cardId);
    if (!card) return false;
    let marked = false;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 9; c++) {
        if (card.numbers[r][c] === number) {
          card.marked[r][c] = true;
          marked = true;
        }
      }
    }
    return marked;
  }

  static evaluateCard(card) {
    let hasLine = false;
    let isBingo = true;
    for (let r = 0; r < 3; r++) {
      let rowComplete = true;
      for (let c = 0; c < 9; c++) {
        if (card.numbers[r][c] !== null && !card.marked[r][c]) {
          rowComplete = false;
          isBingo = false;
        }
      }
      if (rowComplete) hasLine = true;
    }
    return { line: hasLine, bingo: isBingo };
  }

  checkWinable(playerId, cardId) {
    const player = this.players.get(playerId);
    if (!player) return null;
    const card = player.cards.find((c) => c.id === cardId);
    if (!card) return null;
    const result = Room.evaluateCard(card);
    if (this.settings.winMode === 'line') return result.line ? { type: 'line' } : null;
    if (this.settings.winMode === 'bingo') return result.bingo ? { type: 'bingo' } : null;
    // both
    if (result.bingo) return { type: 'bingo' };
    if (result.line) return { type: 'line' };
    return null;
  }

  claimWin(playerId, cardId) {
    const winable = this.checkWinable(playerId, cardId);
    if (!winable) return null;

    // En modo "Línea + Bingo" el premio de línea solo puede reclamarse una vez;
    // el bingo final es el que realmente detiene la partida.
    if (winable.type === 'line' && this.settings.winMode === 'both' && this.lineWinner) {
      return null;
    }

    const player = this.players.get(playerId);
    const final = winable.type === 'bingo' || this.settings.winMode !== 'both';

    if (winable.type === 'line') this.lineWinner = { playerId, playerName: player.name };
    if (winable.type === 'bingo') this.bingoWinner = { playerId, playerName: player.name };

    if (final) {
      this.gameOver = true;
      this.stopAutoplay();
    }

    this.winner = { playerId, playerName: player.name, cardId, type: winable.type, final };
    return this.winner;
  }

  startAutoplay(seconds, onDraw, onEmpty) {
    this.stopAutoplay();
    const s = Math.max(1.5, Math.min(15, Number(seconds) || 3));
    const intervalId = setInterval(() => {
      if (!this.started || this.gameOver || this.pool.length === 0) {
        this.stopAutoplay();
        if (this.pool.length === 0 && onEmpty) onEmpty();
        return;
      }
      onDraw();
    }, s * 1000);
    this.autoplay = { intervalId, seconds: s };
  }

  stopAutoplay() {
    if (this.autoplay) {
      clearInterval(this.autoplay.intervalId);
      this.autoplay = null;
    }
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(settings, hostId, hostName) {
    let code;
    do {
      code = makeCode();
    } while (this.rooms.has(code));
    const room = new Room(code, settings, hostId, hostName);
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get((code || '').toUpperCase());
  }

  destroyIfEmpty(code) {
    const room = this.rooms.get(code);
    if (room && room.isEmpty()) {
      room.stopAutoplay();
      this.rooms.delete(code);
    }
  }
}

module.exports = { RoomManager, Room };
