'use strict';

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { RoomManager } = require('./server/roomManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const manager = new RoomManager();

app.use(express.static(path.join(__dirname, 'public')));

// Mapa socket.id -> roomCode para gestionar desconexiones
const socketRoom = new Map();

function broadcastPlayers(roomCode) {
  const room = manager.get(roomCode);
  if (!room) return;
  io.to(roomCode).emit('players:update', {
    players: room.publicPlayers(),
    creatorId: room.creatorId
  });
}

function safeRoom(roomCode, socket) {
  const room = manager.get(roomCode);
  if (!room) {
    socket.emit('room:error', { message: 'La sala no existe o ha finalizado.' });
    return null;
  }
  return room;
}

io.on('connection', (socket) => {
  // ---------- Crear sala ----------
  socket.on('room:create', ({ settings, playerName } = {}) => {
    try {
      const room = manager.createRoom(settings || {}, socket.id, playerName);
      socket.join(room.code);
      socketRoom.set(socket.id, room.code);
      socket.emit('room:created', {
        roomCode: room.code,
        playerId: socket.id,
        settings: room.settings,
        players: room.publicPlayers(),
        creatorId: room.creatorId
      });
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // ---------- Unirse a sala ----------
  socket.on('room:join', ({ roomCode, playerName } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    if (room.started) {
      socket.emit('room:error', { message: 'La partida ya ha comenzado en esta sala.' });
      return;
    }
    room.addPlayer(socket.id, playerName, false);
    socket.join(room.code);
    socketRoom.set(socket.id, room.code);
    socket.emit('room:joined', {
      roomCode: room.code,
      playerId: socket.id,
      settings: room.settings,
      players: room.publicPlayers(),
      creatorId: room.creatorId
    });
    broadcastPlayers(room.code);
  });

  // ---------- Actualizar opciones individuales ----------
  socket.on('player:setOptions', ({ roomCode, options } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    if (!room.settings.allowIndividualOptions) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    if (typeof options?.autoMark === 'boolean') player.options.autoMark = options.autoMark;
    broadcastPlayers(room.code);
  });

  // ---------- Comprar cartones ----------
  socket.on('cards:buy', ({ roomCode, count } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    try {
      const cards = room.buyCards(socket.id, count);
      socket.emit('cards:bought', { cards });
      broadcastPlayers(room.code);
      if (room.settings.showRivalCards) {
        io.to(room.code).emit('rival:cardsUpdate', {
          playerId: socket.id,
          cards
        });
      }
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // ---------- Iniciar partida ----------
  socket.on('game:start', ({ roomCode } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    if (room.creatorId !== socket.id) {
      socket.emit('room:error', { message: 'Solo el creador de la sala puede iniciar la partida.' });
      return;
    }
    try {
      room.startGame();
      const rivalData = room.settings.showRivalCards
        ? room.publicPlayers().map((p) => ({
            playerId: p.id,
            name: p.name,
            cards: room.players.get(p.id).cards
          }))
        : [];
      io.to(room.code).emit('game:started', {
        settings: room.settings,
        players: room.publicPlayers(),
        rivalCards: rivalData
      });
    } catch (err) {
      socket.emit('room:error', { message: err.message });
    }
  });

  // ---------- Extracción manual (un número) ----------
  function performDraw(room) {
    io.to(room.code).emit('draw:mixing');
    setTimeout(() => {
      const number = room.drawNumber();
      if (number === null) {
        io.to(room.code).emit('draw:poolEmpty');
        room.stopAutoplay();
        return;
      }
      io.to(room.code).emit('draw:number', {
        number,
        extracted: room.extracted,
        remaining: room.pool.length
      });
    }, 1600);
  }

  socket.on('draw:manual', ({ roomCode } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    if (room.creatorId !== socket.id) return;
    if (room.gameOver || !room.started) return;
    performDraw(room);
  });

  socket.on('draw:autoStart', ({ roomCode, intervalSec } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    if (room.creatorId !== socket.id) return;
    io.to(room.code).emit('draw:autoStatus', { active: true, intervalSec });
    room.startAutoplay(
      intervalSec,
      () => performDraw(room),
      () => io.to(room.code).emit('draw:autoStatus', { active: false })
    );
  });

  socket.on('draw:autoStop', ({ roomCode } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    if (room.creatorId !== socket.id) return;
    room.stopAutoplay();
    io.to(room.code).emit('draw:autoStatus', { active: false });
  });

  // ---------- Marcado manual ----------
  socket.on('mark:number', ({ roomCode, cardId, number } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    const ok = room.markNumber(socket.id, cardId, number);
    if (ok) {
      const winable = room.checkWinable(socket.id, cardId);
      if (winable) {
        socket.emit('win:available', { cardId, type: winable.type });
      }
    }
  });

  // ---------- Reclamar victoria ----------
  socket.on('win:claim', ({ roomCode, cardId } = {}) => {
    const room = safeRoom(roomCode, socket);
    if (!room) return;
    const winner = room.claimWin(socket.id, cardId);
    if (winner) {
      if (winner.final) {
        io.to(room.code).emit('game:over', winner);
      } else {
        io.to(room.code).emit('win:lineClaimed', winner);
      }
    } else {
      socket.emit('room:error', { message: 'La condición de victoria ya no es válida o ya fue reclamada por otro jugador.' });
    }
  });

  // ---------- Salir / desconectar ----------
  socket.on('room:leave', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));

  function handleLeave(sock) {
    const roomCode = socketRoom.get(sock.id);
    if (!roomCode) return;
    const room = manager.get(roomCode);
    socketRoom.delete(sock.id);
    if (!room) return;
    room.removePlayer(sock.id);
    sock.leave(roomCode);
    if (room.isEmpty()) {
      manager.destroyIfEmpty(roomCode);
    } else {
      broadcastPlayers(roomCode);
    }
  }
});

server.listen(PORT, () => {
  console.log(`🎱 Bingo 3D corriendo en http://localhost:${PORT}`);
});
