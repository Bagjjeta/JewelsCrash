const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");

const ROWS = 8, COLS = 8, SIZE = 60;
const JEWEL_TYPES = 5;
const COLORS = ["#1abc9c", "#f1c40f", "#e67e22", "#9b59b6", "#e74c3c"];

let board = [];
let selected = null;
let animating = false;
let score = 0;

let hover = null;
let popping = [];
let swapAnim = null;
let hintCell = null;
let hintPair = null;
let hintTimer = null;
let lastMoveTime = Date.now();

function scheduleHintTimer() {
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(checkAndShowHint, 20000);
}
function checkAndShowHint() {
  // Pokazuj podpowiedź TYLKO jeśli przez 20 sekund nie było zamiany miejsc
  const now = Date.now();
  if (now - lastMoveTime >= 20000 && !hintCell) {
    showHint();
  } else {
    // Sprawdź ponownie za 1s, jeśli warunek nie jest spełniony
    hintTimer = setTimeout(checkAndShowHint, 1000);
  }
}
function showHint() {
  if (animating) {
    hintTimer = setTimeout(showHint, 1000);
    return;
  }
  let move = findFirstPossibleMove();
  if (move) {
    hintCell = { x: move.x, y: move.y };
    hintPair = { x: move.x2, y: move.y2 };
  } else {
    hintCell = null;
    hintPair = null;
  }
  draw(performance.now());
  // Podpowiedź nie znika automatycznie, tylko po użyciu!
}

function findFirstPossibleMove() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (canSwap(x, y, x + 1, y)) return { x, y, x2: x + 1, y2: y };
    }
  }
  return null;
}

function clearHintIfUsed(x1, y1, x2, y2) {
  if (
    hintCell &&
    hintPair &&
    (
      ((hintCell.x === x1 && hintCell.y === y1) && (hintPair.x === x2 && hintPair.y === y2)) ||
      ((hintCell.x === x2 && hintCell.y === y2) && (hintPair.x === x1 && hintPair.y === y1))
    )
  ) {
    hintCell = null;
    hintPair = null;
    lastMoveTime = Date.now();
    scheduleHintTimer();
  }
}

function initBoard() {
  board = [];
  for (let y = 0; y < ROWS; y++) {
    let row = [];
    for (let x = 0; x < COLS; x++) {
      row.push(randJewel());
    }
    board.push(row);
  }
  removeInitialMatches();
  if (hintTimer) clearTimeout(hintTimer);
  hintCell = null;
  hintPair = null;
  lastMoveTime = Date.now();
  scheduleHintTimer();
}

function randJewel() {
  return Math.floor(Math.random() * JEWEL_TYPES);
}

function removeInitialMatches() {
  let found;
  do {
    found = false;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        let matches = getMatches(x, y);
        if (matches.length >= 3) {
          board[y][x] = randJewel();
          found = true;
        }
      }
    }
  } while (found);
}

function draw(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw popping jewels
  for (let p of popping) {
    let scale = 1 + 0.2 * Math.sin(Math.PI * p.progress);
    let alpha = 1 - p.progress;
    let jewel = board[p.y][p.x] !== undefined ? board[p.y][p.x] : p.type;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x * SIZE + SIZE / 2, p.y * SIZE + SIZE / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = COLORS[jewel];
    ctx.beginPath();
    ctx.arc(0, 0, SIZE / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Draw swapping jewels
  let drawn = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  if (swapAnim) {
    let { x1, y1, x2, y2, progress } = swapAnim;
    let j1 = board[y1][x1];
    let j2 = board[y2][x2];

    let sx = x1 * SIZE;
    let sy = y1 * SIZE;
    let dx = x2 * SIZE;
    let dy = y2 * SIZE;

    // Animate first jewel
    ctx.save();
    ctx.translate(
      sx + (dx - sx) * progress + SIZE / 2,
      sy + (dy - sy) * progress + SIZE / 2
    );
    ctx.scale(
      selected && selected.x === x1 && selected.y === y1
        ? 1.2 + 0.04 * Math.sin(now / 120)
        : 1,
      selected && selected.x === x1 && selected.y === y1
        ? 1.2 + 0.04 * Math.sin(now / 120)
        : 1
    );
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = COLORS[j1];
    ctx.beginPath();
    ctx.arc(0, 0, SIZE / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (selected && selected.x === x1 && selected.y === y1) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (hover && hover.x === x1 && hover.y === y1 && !animating) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    drawn[y1][x1] = true;

    // Animate second jewel
    ctx.save();
    ctx.translate(
      dx + (sx - dx) * progress + SIZE / 2,
      dy + (sy - dy) * progress + SIZE / 2
    );
    ctx.scale(
      selected && selected.x === x2 && selected.y === y2
        ? 1.2 + 0.04 * Math.sin(now / 120)
        : 1,
      selected && selected.x === x2 && selected.y === y2
        ? 1.2 + 0.04 * Math.sin(now / 120)
        : 1
    );
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 15;
    ctx.fillStyle = COLORS[j2];
    ctx.beginPath();
    ctx.arc(0, 0, SIZE / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (selected && selected.x === x2 && selected.y === y2) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (hover && hover.x === x2 && hover.y === y2 && !animating) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
    drawn[y2][x2] = true;
  }

  // Draw normal jewels
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (drawn[y][x]) continue;
      if (popping.some(p => p.x === x && p.y === y)) continue;
      let jewel = board[y][x];
      let scale = 1;
      let shadow = false;
      if (hover && hover.x === x && hover.y === y && !animating) {
        scale = 1.1;
        shadow = true;
      }
      if (selected && selected.x === x && selected.y === y) {
        scale = 1.2 + 0.04 * Math.sin(now / 120);
        shadow = true;
      }
      // Podpowiedź: pulsujący efekt na obu klejnotach z podpowiedzi
      if (
        hintCell && hintPair &&
        (
          (hintCell.x === x && hintCell.y === y) ||
          (hintPair.x === x && hintPair.y === y)
        )
        && !selected && !animating
      ) {
        scale = 1.15 + 0.03 * Math.sin(now / 80);
        shadow = true;
      }
      ctx.save();
      ctx.translate(x * SIZE + SIZE / 2, y * SIZE + SIZE / 2);
      ctx.scale(scale, scale);
      if (shadow) {
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 15;
      }
      ctx.fillStyle = COLORS[jewel];
      ctx.beginPath();
      ctx.arc(0, 0, SIZE / 2 - 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      if (selected && selected.x === x && selected.y === y) {
        ctx.strokeStyle = "#fff";
        ctx.stroke();
      } else if (hover && hover.x === x && hover.y === y && !animating) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (
        hintCell && hintPair &&
        ((hintCell.x === x && hintCell.y === y) ||
         (hintPair.x === x && hintPair.y === y))
        && !selected && !animating
      ) {
        ctx.strokeStyle = "#FFD700";
        ctx.lineWidth = 4;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
    }
  }
}

function getMatches(x, y) {
  const jewel = board[y][x];
  let horiz = [{ x, y }], vert = [{ x, y }];
  for (let dx = x - 1; dx >= 0 && board[y][dx] === jewel; dx--) horiz.push({ x: dx, y });
  for (let dx = x + 1; dx < COLS && board[y][dx] === jewel; dx++) horiz.push({ x: dx, y });
  for (let dy = y - 1; dy >= 0 && board[dy][x] === jewel; dy--) vert.push({ x, y: dy });
  for (let dy = y + 1; dy < ROWS && board[dy][x] === jewel; dy++) vert.push({ x, y: dy });
  let result = [];
  if (horiz.length >= 3) result = result.concat(horiz);
  if (vert.length >= 3) result = result.concat(vert);
  return result.filter((v, i, a) => a.findIndex(t => t.x === v.x && t.y === v.y) === i);
}

function canSwap(x1, y1, x2, y2) {
  if (y1 !== y2 || Math.abs(x1 - x2) !== 1) return false;
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  const can = getMatches(x1, y1).length >= 3 || getMatches(x2, y2).length >= 3;
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  return can;
}

canvas.addEventListener("mousedown", e => {
  if (animating) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / SIZE);
  const y = Math.floor((e.clientY - rect.top) / SIZE);
  if (!selected) {
    selected = { x, y };
  } else {
    if (canSwap(selected.x, selected.y, x, y)) {
      clearHintIfUsed(selected.x, selected.y, x, y); // <-- kluczowe
      animateSwap(selected.x, selected.y, x, y, () => {
        swapJewels(selected.x, selected.y, x, y, true);
      });
    } else {
      selected = null;
    }
  }
  draw(performance.now());
});

canvas.addEventListener("mousemove", e => {
  if (animating) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / SIZE);
  const y = Math.floor((e.clientY - rect.top) / SIZE);
  if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
    hover = { x, y };
    draw(performance.now());
  } else {
    hover = null;
    draw(performance.now());
  }
});

canvas.addEventListener("mouseleave", () => {
  hover = null;
  draw(performance.now());
});

// Update the swapJewels function to clear any active hint on a successful swap
function swapJewels(x1, y1, x2, y2, animate) {
  animating = true;
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  draw(performance.now());
  setTimeout(() => {
    if (!removeMatches()) {
      animateSwap(x1, y1, x2, y2, () => {
        [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
        selected = null;
        animating = false;
        draw(performance.now());
      }, true);
    } else {
      // Clear any hint when a successful swap occurs
      hintCell = null;
      hintPair = null;
      
      // Update lastMoveTime after a successful match
      lastMoveTime = Date.now();
      // Reset timer to wait another 20 seconds
      scheduleHintTimer();
      
      selected = null;
      animating = false;
      draw(performance.now());
    }
  }, animate ? 200 : 0);
}

function removeMatches() {
  let removed = false;
  let marks = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let matches = getMatches(x, y);
      if (matches.length >= 3) {
        matches.forEach(({ x, y }) => marks[y][x] = true);
        removed = true;
      }
    }
  }
  if (removed) {
    popping = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (marks[y][x]) popping.push({ x, y, progress: 0, type: board[y][x] });
      }
    }
    animatePop(() => {
      let points = 0;
      for (let x = 0; x < COLS; x++) {
        let col = [];
        for (let y = ROWS - 1; y >= 0; y--) {
          if (!marks[y][x]) col.unshift(board[y][x]);
          else points += 10;
        }
        while (col.length < ROWS) col.unshift(randJewel());
        for (let y = 0; y < ROWS; y++) board[y][x] = col[y];
      }
      score += points;
      scoreDiv.textContent = "Wynik: " + score;
      popping = [];
      setTimeout(() => {
        draw(performance.now());
        setTimeout(() => removeMatches(), 150);
      }, 80);
    });
  }
  return removed;
}

function animatePop(onComplete) {
  let start = null;
  function popFrame(ts) {
    if (!start) start = ts;
    let t = (ts - start) / 350;
    popping.forEach(p => p.progress = Math.min(1, t));
    draw(ts);
    if (t < 1) {
      requestAnimationFrame(popFrame);
    } else {
      onComplete();
    }
  }
  requestAnimationFrame(popFrame);
}

function animateSwap(x1, y1, x2, y2, onComplete, reverse = false) {
  animating = true;
  let start = null;
  function swapFrame(ts) {
    if (!start) start = ts;
    let t = Math.min(1, (ts - start) / 200);
    if (reverse) t = 1 - t;
    swapAnim = { x1, y1, x2, y2, progress: t };
    draw(ts);
    if ((!reverse && t < 1) || (reverse && t > 0)) {
      requestAnimationFrame(swapFrame);
    } else {
      swapAnim = null;
      onComplete();
    }
  }
  requestAnimationFrame(swapFrame);
}

function animate() {
  draw(performance.now());
  requestAnimationFrame(animate);
}

// Start gry
initBoard();
animate();