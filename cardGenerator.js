'use strict';

/**
 * Generador de cartones de Bingo 90 (formato clásico 3 filas x 9 columnas,
 * 5 números por fila, 15 números por cartón).
 *
 * Rangos de columnas (estilo Bingo tradicional):
 * col0: 1-9, col1: 10-19, ..., col7: 70-79, col8: 80-90
 */

const COLUMN_RANGES = [
  [1, 9], [10, 19], [20, 29], [30, 39], [40, 49],
  [50, 59], [60, 69], [70, 79], [80, 90]
];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Genera cuántos números tendrá cada una de las 9 columnas (suma total = 15, cada una entre 1 y 3). */
function generateColumnCounts() {
  const counts = new Array(9).fill(1); // 9 columnas x 1 = 9
  const capacity = new Array(9).fill(2); // cada columna puede crecer hasta +2 (máx 3)
  let remaining = 15 - 9; // faltan 6 por repartir
  let guard = 0;
  while (remaining > 0 && guard < 10000) {
    const idx = Math.floor(Math.random() * 9);
    if (capacity[idx] > 0) {
      counts[idx]++;
      capacity[idx]--;
      remaining--;
    }
    guard++;
  }
  return counts;
}

/** Decide en qué filas aparecerá cada columna, garantizando 5 números por fila. */
function assignRows(colCounts) {
  const grid = [new Array(9).fill(false), new Array(9).fill(false), new Array(9).fill(false)];
  const remaining = colCounts.slice();

  for (let r = 0; r < 3; r++) {
    const rowsLeft = 3 - r;
    const forced = [];
    const candidates = [];

    for (let c = 0; c < 9; c++) {
      if (remaining[c] <= 0) continue;
      if (remaining[c] === rowsLeft) forced.push(c);
      else candidates.push(c);
    }

    let chosen = [...forced];
    shuffle(candidates);
    for (const c of candidates) {
      if (chosen.length >= 5) break;
      chosen.push(c);
    }

    // Red de seguridad por si la combinatoria dejara menos de 5 (caso raro)
    if (chosen.length < 5) {
      for (let c = 0; c < 9; c++) {
        if (chosen.includes(c)) continue;
        if (remaining[c] > 0) {
          chosen.push(c);
          if (chosen.length >= 5) break;
        }
      }
    }
    chosen = chosen.slice(0, 5);

    for (const c of chosen) {
      grid[r][c] = true;
      remaining[c]--;
    }
  }

  const fullyPlaced = remaining.every((v) => v === 0);
  const rowsOk = grid.every((row) => row.filter(Boolean).length === 5);
  return { grid, valid: fullyPlaced && rowsOk };
}

/** A partir de la disposición boolean, elige los números reales (ordenados ascendente por columna). */
function buildCardNumbers(grid) {
  const numbers = [new Array(9).fill(null), new Array(9).fill(null), new Array(9).fill(null)];

  for (let c = 0; c < 9; c++) {
    const rowsWithCol = [0, 1, 2].filter((r) => grid[r][c]);
    if (rowsWithCol.length === 0) continue;

    const [lo, hi] = COLUMN_RANGES[c];
    const pool = [];
    for (let n = lo; n <= hi; n++) pool.push(n);
    shuffle(pool);

    const picked = pool.slice(0, rowsWithCol.length).sort((a, b) => a - b);
    rowsWithCol.forEach((r, i) => {
      numbers[r][c] = picked[i];
    });
  }

  return numbers;
}

/** Genera un único cartón válido (con reintentos internos por seguridad). */
function generateCard() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const colCounts = generateColumnCounts();
    const { grid, valid } = assignRows(colCounts);
    if (valid) {
      return buildCardNumbers(grid);
    }
  }
  // Fallback extremadamente improbable: reintenta sin condición de validación estricta
  const colCounts = generateColumnCounts();
  const { grid } = assignRows(colCounts);
  return buildCardNumbers(grid);
}

function serializeCard(numbers) {
  return numbers.flat().map((n) => (n === null ? '.' : n)).join(',');
}

/**
 * Genera `count` cartones garantizando que ninguno se repita respecto
 * a los ya existentes en `existingSerials` (un Set compartido a nivel de sala).
 */
function generateUniqueCards(count, existingSerials) {
  const cards = [];
  let guard = 0;
  const maxGuard = count * 200 + 2000;

  while (cards.length < count && guard < maxGuard) {
    guard++;
    const numbers = generateCard();
    const serial = serializeCard(numbers);
    if (existingSerials.has(serial)) continue;
    existingSerials.add(serial);
    cards.push(numbers);
  }

  // Si por extrema mala suerte no se pudieron generar todos únicos (prácticamente imposible),
  // se completan permitiendo repetición para no bloquear al jugador.
  while (cards.length < count) {
    const numbers = generateCard();
    cards.push(numbers);
  }

  return cards;
}

module.exports = { generateCard, generateUniqueCards, serializeCard, COLUMN_RANGES };
