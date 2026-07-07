import { state, on } from './state.js';
import * as api from './socketClient.js';
import * as cage from './cage3d.js';
import * as sound from './sound.js';

// ---------- Helpers ----------
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function showScreen(id) {
  ['screen-lobby', 'screen-room', 'screen-game'].forEach((s) => {
    $('#' + s).classList.toggle('hidden', s !== id);
  });
}

function toast(message, isError = false) {
  const area = $('#toast-area');
  const div = document.createElement('div');
  div.className = 'toast';
  if (isError) div.style.borderLeftColor = '#ff4d4d';
  div.textContent = message;
  area.appendChild(div);
  setTimeout(() => div.remove(), 4200);
}

// ================= LOBBY =================
$$('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-create').classList.toggle('hidden', btn.dataset.tab !== 'create');
    $('#tab-join').classList.toggle('hidden', btn.dataset.tab !== 'join');
  });
});

$('#btn-create-room').addEventListener('click', () => {
  sound.playClick();
  const name = $('#create-name').value.trim() || 'Anfitrión';
  const settings = {
    winMode: $('#opt-winmode').value,
    autoMark: $('#opt-automark').checked,
    showRivalCards: $('#opt-rivals').checked,
    allowIndividualOptions: $('#opt-individual').checked,
    cageStyle: $('#opt-cagestyle').value
  };
  api.createRoom(settings, name);
});

$('#btn-join-room').addEventListener('click', () => {
  sound.playClick();
  const name = $('#join-name').value.trim() || 'Jugador';
  const code = $('#join-code').value.trim().toUpperCase();
  if (code.length !== 6) {
    $('#lobby-error').textContent = 'El código debe tener 6 caracteres.';
    return;
  }
  api.joinRoom(code, name);
});

on('room:error', (data) => {
  $('#lobby-error').textContent = data.message;
  $('#room-error').textContent = data.message;
  toast(data.message, true);
});

// ================= SALA DE ESPERA =================
on('room:entered', (data) => {
  $('#lobby-error').textContent = '';
  $('#room-code-text').textContent = data.roomCode;
  showScreen('screen-room');
  renderRoomSettings(data.settings);
  renderPlayerList(data.players, data.creatorId);
  $('#creator-options').classList.toggle('hidden', !state.isCreator);
  $('#btn-start-game').classList.toggle('hidden', !state.isCreator);
  $('#individual-options').classList.toggle('hidden', !data.settings.allowIndividualOptions);
});

on('players:update', (data) => {
  renderPlayerList(data.players, data.creatorId);
  $('#btn-start-game').classList.toggle('hidden', !state.isCreator);
  $('#creator-options').classList.toggle('hidden', !state.isCreator);
  const me = data.players.find((p) => p.id === state.myId);
  if (me) $('#my-card-count').textContent = `${me.cardCount} cartón(es)`;
});

function renderRoomSettings(settings) {
  const modeLabel = { line: 'Solo Línea', bingo: 'Solo Bingo', both: 'Línea + Bingo' }[settings.winMode];
  $('#room-settings-summary').innerHTML = `
    <div class="row"><span>Modo de victoria</span><strong>${modeLabel}</strong></div>
    <div class="row"><span>Marcado automático por defecto</span><strong>${settings.autoMark ? 'Sí' : 'No'}</strong></div>
    <div class="row"><span>Ver cartones rivales</span><strong>${settings.showRivalCards ? 'Sí' : 'No'}</strong></div>
    <div class="row"><span>Forma del bombo</span><strong>${settings.cageStyle === 'cage' ? 'Jaula' : 'Esfera'}</strong></div>
  `;
}

function renderPlayerList(players, creatorId) {
  $('#player-list').innerHTML = players.map((p) => `
    <li>
      <span>${p.id === creatorId ? '<span class="crown">👑</span>' : ''}${escapeHtml(p.name)}${p.id === state.myId ? ' (tú)' : ''}</span>
      <span>${p.cardCount} 🎫</span>
    </li>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

$('#btn-copy-code').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(state.roomCode);
    toast('Código copiado al portapapeles ✅');
  } catch {
    toast('No se pudo copiar. Código: ' + state.roomCode, true);
  }
});

$('#btn-buy-cards').addEventListener('click', () => {
  const count = Math.max(1, Math.min(100, parseInt($('#buy-count').value, 10) || 1));
  api.buyCards(count);
});

on('cards:bought', () => {
  toast(`Compraste cartones. Total: ${state.myCards.length}`);
});

$('#my-automark').addEventListener('change', (e) => {
  api.setMyOptions({ autoMark: e.target.checked });
});

$('#btn-start-game').addEventListener('click', () => {
  if (state.myCards.length === 0) {
    $('#room-error').textContent = 'Debes comprar al menos un cartón antes de iniciar.';
    return;
  }
  api.startGame();
});

$('#btn-leave-room').addEventListener('click', () => {
  api.leaveRoom();
  location.reload();
});

// ================= JUEGO =================
on('game:started', (data) => {
  showScreen('screen-game');
  $('#draw-controls-creator').classList.toggle('hidden', !state.isCreator);
  $('#rival-section').classList.toggle('hidden', !data.settings.showRivalCards);

  cage.initCage($('#cage-container'), data.settings.cageStyle);

  renderNumberBoard();
  renderHistory();
  renderCurrentCard();
  renderRivalTabs();
});

// --- Tablero 1-90 ---
function renderNumberBoard() {
  const board = $('#number-board');
  let html = '';
  for (let n = 1; n <= 90; n++) {
    html += `<div class="number-cell" data-n="${n}">${n}</div>`;
  }
  board.innerHTML = html;
}

function markBoard(number) {
  const cell = $(`#number-board .number-cell[data-n="${number}"]`);
  if (cell) cell.classList.add('drawn');
  $$('#number-board .number-cell.last').forEach((c) => c.classList.remove('last'));
  if (cell) cell.classList.add('last');
}

function renderHistory() {
  const strip = $('#history-strip');
  strip.innerHTML = state.extracted.slice().reverse()
    .map((n) => `<div class="history-chip">${n}</div>`).join('');
}

// --- Extracción ---
on('draw:mixing', () => {
  cage.setMixing(true);
  sound.playMixing();
});

on('draw:number', (data) => {
  cage.setMixing(false);
  cage.extractBall(data.number);
  sound.playDraw();
  $('#last-ball').textContent = data.number;
  markBoard(data.number);
  renderHistory();
  refreshCardMarks();
  checkMyWinStatus();
});

on('draw:poolEmpty', () => {
  toast('Se han extraído las 90 bolas.');
});

on('draw:autoStatus', (data) => {
  const btn = $('#btn-autoplay-toggle');
  btn.textContent = data.active ? '⏸ Detener auto-jugar' : '▶ Auto-jugar';
});

$('#btn-draw-manual').addEventListener('click', () => {
  $('#btn-draw-manual').disabled = true;
  api.drawManual();
  setTimeout(() => { $('#btn-draw-manual').disabled = false; }, 1700);
});

$('#btn-autoplay-toggle').addEventListener('click', () => {
  if (state.autoplayActive) {
    api.autoStop();
  } else {
    const sec = parseInt($('#autoplay-interval').value, 10);
    api.autoStart(sec);
  }
});

// --- Cartones propios ---
function renderCurrentCard() {
  const total = state.myCards.length;
  if (total === 0) {
    $('#bingo-card-table').innerHTML = '<tr><td class="empty">Sin cartones</td></tr>';
    $('#card-nav-label').textContent = '0/0';
    return;
  }
  if (state.currentCardIndex >= total) state.currentCardIndex = total - 1;
  const card = state.myCards[state.currentCardIndex];
  $('#card-nav-label').textContent = `Cartón ${state.currentCardIndex + 1}/${total}`;
  $('#bingo-card-table').innerHTML = buildCardTableHtml(card, true);
  attachCardCellListeners(card);
  checkMyWinStatus();
}

function buildCardTableHtml(card, interactive) {
  let html = '';
  for (let r = 0; r < 3; r++) {
    html += '<tr>';
    for (let c = 0; c < 9; c++) {
      const val = card.numbers[r][c];
      if (val === null) {
        html += '<td class="empty"></td>';
      } else {
        const marked = card.marked[r][c];
        const autoCls = marked && state.settings && state.settings.autoMark ? ' auto' : '';
        html += `<td data-r="${r}" data-c="${c}" data-val="${val}" class="${marked ? 'marked' + autoCls : ''}">${val}</td>`;
      }
    }
    html += '</tr>';
  }
  return html;
}

function attachCardCellListeners(card) {
  $$('#bingo-card-table td[data-val]').forEach((td) => {
    td.addEventListener('click', () => {
      const val = parseInt(td.dataset.val, 10);
      if (!state.extracted.includes(val)) {
        toast('Ese número aún no ha salido.', true);
        return;
      }
      const r = parseInt(td.dataset.r, 10), c = parseInt(td.dataset.c, 10);
      card.marked[r][c] = true;
      td.classList.add('marked');
      sound.playMark();
      api.markNumber(card.id, val);
      checkMyWinStatus();
    });
  });
}

function refreshCardMarks() {
  // Vuelve a pintar el cartón actual para reflejar auto-marcado del servidor
  renderCurrentCard();
}

$('#btn-prev-card').addEventListener('click', () => {
  if (state.myCards.length === 0) return;
  state.currentCardIndex = (state.currentCardIndex - 1 + state.myCards.length) % state.myCards.length;
  renderCurrentCard();
});
$('#btn-next-card').addEventListener('click', () => {
  if (state.myCards.length === 0) return;
  state.currentCardIndex = (state.currentCardIndex + 1) % state.myCards.length;
  renderCurrentCard();
});

// --- Victoria ---
function checkMyWinStatus() {
  const card = state.myCards[state.currentCardIndex];
  const claimBtn = $('#btn-claim-win');
  if (!card) { claimBtn.classList.add('hidden'); return; }
  const anyRowComplete = card.marked.some((row, r) =>
    row.every((m, c) => card.numbers[r][c] === null || m)
  );
  const allComplete = card.marked.every((row, r) =>
    row.every((m, c) => card.numbers[r][c] === null || m)
  );
  const mode = state.settings ? state.settings.winMode : 'both';
  const winable = (mode === 'line' && anyRowComplete) ||
                  (mode === 'bingo' && allComplete) ||
                  (mode === 'both' && (anyRowComplete || allComplete));
  claimBtn.classList.toggle('hidden', !winable || state.gameOver);
}

on('win:available', () => {
  checkMyWinStatus();
  toast('¡Tienes una combinación ganadora! Puedes reclamar el premio 🏆');
});

$('#btn-claim-win').addEventListener('click', () => {
  const card = state.myCards[state.currentCardIndex];
  if (!card) return;
  api.claimWin(card.id);
});

on('win:lineClaimed', (data) => {
  sound.playWin();
  $('#win-title').textContent = '¡LÍNEA!';
  $('#win-subtitle').textContent = data.playerId === state.myId
    ? '¡Has ganado la línea! La partida continúa por el Bingo 🎯'
    : `${escapeHtml(data.playerName)} ha completado línea. ¡La partida continúa!`;
  $('#win-banner').classList.remove('hidden');
});

on('game:over', (data) => {
  sound.playWin();
  cage.setMixing(false);
  $('#draw-controls-creator').classList.add('hidden');
  $('#btn-claim-win').classList.add('hidden');
  $('#win-title').textContent = data.type === 'bingo' ? '¡BINGO!' : '¡LÍNEA!';
  $('#win-subtitle').textContent = data.playerId === state.myId
    ? '¡Has ganado tú! 🎉'
    : `Ganador: ${escapeHtml(data.playerName)}`;
  $('#win-banner').classList.remove('hidden');
});

$('#btn-close-win').addEventListener('click', () => {
  $('#win-banner').classList.add('hidden');
});

// --- Cartones rivales ---
function renderRivalTabs() {
  const tabsEl = $('#rival-tabs');
  const entries = Array.from(state.rivalCards.entries()).filter(([id]) => id !== state.myId);
  tabsEl.innerHTML = entries.map(([id, data], idx) =>
    `<div class="rival-tab${idx === 0 ? ' active' : ''}" data-id="${id}">${escapeHtml(data.name)} (${data.cards.length})</div>`
  ).join('');
  if (entries.length > 0) renderRivalCard(entries[0][0]);
  $$('.rival-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.rival-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderRivalCard(tab.dataset.id);
    });
  });
}

function renderRivalCard(playerId) {
  const data = state.rivalCards.get(playerId);
  if (!data || data.cards.length === 0) {
    $('#rival-card-table').innerHTML = '<tr><td class="empty">Sin cartones</td></tr>';
    return;
  }
  $('#rival-card-table').innerHTML = buildCardTableHtml(data.cards[0], false);
}

on('rival:update', () => {
  if (!$('#screen-game').classList.contains('hidden')) renderRivalTabs();
});
