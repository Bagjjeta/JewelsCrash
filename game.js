// Game with menu and sound effects
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");

// Game constants
const ROWS = 8, COLS = 8, SIZE = 60;
const JEWEL_TYPES = 5;
const COLORS = ["#1abc9c", "#f1c40f", "#e67e22", "#9b59b6", "#e74c3c"];
const HEADER_HEIGHT = 40; // Height of the UI header

// Game state
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
let gameState = "menu"; // "menu", "game", "paused", "help", "settings"
let soundEnabled = true;
let musicEnabled = true;
let particleEffects = [];

// Sound effects
const sounds = {
  select: new Audio('https://assets.mixkit.co/active_storage/sfx/1115/1115-preview.mp3'),
  swap: new Audio('https://assets.mixkit.co/active_storage/sfx/270/270-preview.mp3'),
  match: new Audio('https://assets.mixkit.co/active_storage/sfx/217/217-preview.mp3'),
  hint: new Audio('https://assets.mixkit.co/active_storage/sfx/2/2-preview.mp3'),
  button: new Audio('https://assets.mixkit.co/active_storage/sfx/220/220-preview.mp3'),
  music: new Audio('https://assets.mixkit.co/active_storage/sfx/209/209-preview.mp3')
};

// Preload sounds
Object.values(sounds).forEach(sound => {
  sound.load();
  sound.volume = 0.5;
});

// Background music settings
sounds.music.loop = true;
sounds.music.volume = 0.3;

// Play sounds with check for mute
function playSound(sound) {
  if (soundEnabled && sounds[sound]) {
    sounds[sound].currentTime = 0;
    sounds[sound].play().catch(e => console.log("Audio play error:", e));
  }
}

// Toggle background music
function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    sounds.music.play().catch(e => console.log("Music play error:", e));
  } else {
    sounds.music.pause();
  }
}

// Menu buttons
const buttons = [
  { text: "PLAY", x: canvas.width / 2, y: 200, width: 200, height: 50, action: () => startGame() },
  { text: "SETTINGS", x: canvas.width / 2, y: 270, width: 200, height: 50, action: () => { gameState = "settings"; } },
  { text: "HELP", x: canvas.width / 2, y: 340, width: 200, height: 50, action: () => { gameState = "help"; } }
];

// Settings buttons
const settingsButtons = [
  { text: "SOUND: ON", x: canvas.width / 2, y: 200, width: 240, height: 50, 
    action: () => { 
      soundEnabled = !soundEnabled; 
      settingsButtons[0].text = soundEnabled ? "SOUND: ON" : "SOUND: OFF";
    } 
  },
  { text: "MUSIC: ON", x: canvas.width / 2, y: 270, width: 240, height: 50, 
    action: () => { 
      toggleMusic(); 
      settingsButtons[1].text = musicEnabled ? "MUSIC: ON" : "MUSIC: OFF";
    } 
  },
  { text: "BACK", x: canvas.width / 2, y: 340, width: 200, height: 50, action: () => { gameState = "menu"; } }
];

// Schedule hint timer
function scheduleHintTimer() {
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(checkAndShowHint, 20000);
}

// Check and show hint
function checkAndShowHint() {
  // Show hint only if 20 seconds passed without a gem swap
  const now = Date.now();
  if (now - lastMoveTime >= 20000 && !hintCell && gameState === "game") {
    showHint();
  } else {
    // Check again in 1s if condition is not met
    hintTimer = setTimeout(checkAndShowHint, 1000);
  }
}

// Show hint
function showHint() {
  if (animating || gameState !== "game") {
    hintTimer = setTimeout(showHint, 1000);
    return;
  }
  let move = findFirstPossibleMove();
  if (move) {
    hintCell = { x: move.x, y: move.y };
    hintPair = { x: move.x2, y: move.y2 };
    playSound("hint");
  } else {
    hintCell = null;
    hintPair = null;
  }
  draw(performance.now());
  // Hint disappears only when used!
}

// Find first possible move
function findFirstPossibleMove() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (canSwap(x, y, x + 1, y)) return { x, y, x2: x + 1, y2: y };
    }
  }
  return null;
}

// Clear hint if used
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

// Initialize game board
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
  score = 0;
  scoreDiv.textContent = "Wynik: 0";
}

// Generate random jewel
function randJewel() {
  return Math.floor(Math.random() * JEWEL_TYPES);
}

// Remove initial matches
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

// Draw the game
function draw(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#1a1a2e");
  gradient.addColorStop(1, "#16213e");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (gameState === "menu") {
    drawMenu(now);
  } else if (gameState === "settings") {
    drawSettings(now);
  } else if (gameState === "help") {
    drawHelp();
  } else if (gameState === "game" || gameState === "paused") {
    drawGame(now);
    
    if (gameState === "paused") {
      // Draw pause overlay
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = "#fff";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2 - 20);
      
      ctx.font = "20px Arial";
      ctx.fillText("Click to continue", canvas.width / 2, canvas.height / 2 + 20);
    }
  }
  
  // Draw particles
  drawParticles();
}

// Draw particles
function drawParticles() {
  // Update and draw particles
  for (let i = particleEffects.length - 1; i >= 0; i--) {
    const p = particleEffects[i];
    p.life -= 0.02;
    p.x += p.vx;
    p.y += p.vy;
    p.size *= 0.95;
    
    if (p.life <= 0) {
      particleEffects.splice(i, 1);
      continue;
    }
    
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Create particles
function createParticles(x, y, color, count = 20) {
  for (let i = 0; i < count; i++) {
    particleEffects.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: Math.random() * 5 + 2,
      color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 1
    });
  }
}

// Draw menu
function drawMenu(now) {
  // Title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("JEWELS CRASH", canvas.width / 2, 120);
  
  // Animated gem icon
  const gemSize = 40;
  const gemX = canvas.width / 2;
  const gemY = 140;
  const pulse = 1 + 0.1 * Math.sin(now / 200);
  
  ctx.save();
  ctx.translate(gemX, gemY);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = COLORS[Math.floor(now / 500) % COLORS.length];
  ctx.beginPath();
  ctx.arc(0, 0, gemSize, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  
  // Draw menu buttons
  for (const button of buttons) {
    drawButton(button, hover && 
               hover.x >= button.x - button.width / 2 &&
               hover.x <= button.x + button.width / 2 &&
               hover.y >= button.y - button.height / 2 &&
               hover.y <= button.y + button.height / 2);
  }
  
  // Credits
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "15px Arial";
  ctx.fillText("© 2025 Bagjjeta", canvas.width / 2, canvas.height - 20);
}

// Draw settings
function drawSettings(now) {
  // Settings title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SETTINGS", canvas.width / 2, 120);
  
  // Draw settings buttons
  for (const button of settingsButtons) {
    drawButton(button, hover && 
               hover.x >= button.x - button.width / 2 &&
               hover.x <= button.x + button.width / 2 &&
               hover.y >= button.y - button.height / 2 &&
               hover.y <= button.y + button.height / 2);
  }
}

// Draw help
function drawHelp() {
  // Help title
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("HOW TO PLAY", canvas.width / 2, 80);
  
  // Help text
  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  const lineHeight = 25;
  let y = 130;
  
  const helpText = [
    "1. Swap adjacent jewels to create matches of 3 or more",
    "2. Matches must be in a horizontal or vertical line",
    "3. Create matches to score points",
    "4. If you get stuck, wait for a hint to appear",
    "5. Press ESC to pause the game"
  ];
  
  for (const line of helpText) {
    ctx.fillText(line, 80, y);
    y += lineHeight;
  }
  
  // Example
  y += 20;
  ctx.fillText("Example:", 80, y);
  
  // Draw example match
  y += 35;
  const exampleGemSize = 30;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(130 + i * (exampleGemSize * 1.5), y);
    ctx.fillStyle = COLORS[0];
    ctx.beginPath();
    ctx.arc(0, 0, exampleGemSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  
  // Back button
  drawButton({ 
    text: "BACK", 
    x: canvas.width / 2, 
    y: canvas.height - 60, 
    width: 200, 
    height: 50, 
    action: () => { gameState = "menu"; } 
  }, hover && 
     hover.x >= canvas.width / 2 - 100 &&
     hover.x <= canvas.width / 2 + 100 &&
     hover.y >= canvas.height - 60 - 25 &&
     hover.y <= canvas.height - 60 + 25);
}

// Draw a button
function drawButton(button, isHovered) {
  const x = button.x;
  const y = button.y;
  const width = button.width;
  const height = button.height;
  
  // Button background
  const gradient = ctx.createLinearGradient(x - width / 2, y - height / 2, x - width / 2, y + height / 2);
  if (isHovered) {
    gradient.addColorStop(0, "#4a69bd");
    gradient.addColorStop(1, "#6a89cc");
  } else {
    gradient.addColorStop(0, "#1e3799");
    gradient.addColorStop(1, "#4a69bd");
  }
  
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  
  // Rounded rectangle
  ctx.beginPath();
  ctx.moveTo(x - width / 2 + 10, y - height / 2);
  ctx.lineTo(x + width / 2 - 10, y - height / 2);
  ctx.quadraticCurveTo(x + width / 2, y - height / 2, x + width / 2, y - height / 2 + 10);
  ctx.lineTo(x + width / 2, y + height / 2 - 10);
  ctx.quadraticCurveTo(x + width / 2, y + height / 2, x + width / 2 - 10, y + height / 2);
  ctx.lineTo(x - width / 2 + 10, y + height / 2);
  ctx.quadraticCurveTo(x - width / 2, y + height / 2, x - width / 2, y + height / 2 - 10);
  ctx.lineTo(x - width / 2, y - height / 2 + 10);
  ctx.quadraticCurveTo(x - width / 2, y - height / 2, x - width / 2 + 10, y - height / 2);
  ctx.closePath();
  
  ctx.fill();
  ctx.stroke();
  
  // Button text
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(button.text, x, y);
  
  // Glow effect if hovered
  if (isHovered) {
    ctx.shadowColor = "#4a69bd";
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// Draw the game board
function drawGame(now) {
  // Create a semi-transparent header bar above the game board
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, HEADER_HEIGHT);
  
  // Draw menu button on the left of the header
  drawButton({ 
    text: "MENU", 
    x: 50, 
    y: HEADER_HEIGHT / 2, 
    width: 80, 
    height: 30, 
    action: () => { gameState = "menu"; } 
  }, hover && 
     hover.x >= 10 &&
     hover.x <= 90 &&
     hover.y >= 5 &&
     hover.y <= 35);
  
  // Draw score in the center
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Score: " + score, canvas.width / 2, HEADER_HEIGHT / 2 + 5);
  
  // Draw pause info on the right
  ctx.font = "16px Arial";
  ctx.textAlign = "right";
  ctx.fillText("ESC - Pause", canvas.width - 20, HEADER_HEIGHT / 2 + 5);
  
  // Draw popping jewels
  for (let p of popping) {
    let scale = 1 + 0.2 * Math.sin(Math.PI * p.progress);
    let alpha = 1 - p.progress;
    let jewel = board[p.y][p.x] !== undefined ? board[p.y][p.x] : p.type;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x * SIZE + SIZE / 2, p.y * SIZE + SIZE / 2 + HEADER_HEIGHT);
    ctx.scale(scale, scale);
    ctx.fillStyle = COLORS[jewel];
    ctx.beginPath();
    ctx.arc(0, 0, SIZE / 2 - 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Add shine effect
    const gradient = ctx.createRadialGradient(
      -SIZE/6, -SIZE/6, 0,
      0, 0, SIZE/2 - 6
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
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
    let sy = y1 * SIZE + HEADER_HEIGHT;
    let dx = x2 * SIZE;
    let dy = y2 * SIZE + HEADER_HEIGHT;

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
    
    // Add shine effect
    const gradient1 = ctx.createRadialGradient(
      -SIZE/6, -SIZE/6, 0,
      0, 0, SIZE/2 - 6
    );
    gradient1.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    gradient1.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient1;
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
    
    // Add shine effect
    const gradient2 = ctx.createRadialGradient(
      -SIZE/6, -SIZE/6, 0,
      0, 0, SIZE/2 - 6
    );
    gradient2.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    gradient2.addColorStop(0.5, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient2;
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
      // Hint: pulsing effect on both hint gems
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
      ctx.translate(x * SIZE + SIZE / 2, y * SIZE + SIZE / 2 + HEADER_HEIGHT);
      ctx.scale(scale, scale);
      if (shadow) {
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 15;
      }
      ctx.fillStyle = COLORS[jewel];
      ctx.beginPath();
      ctx.arc(0, 0, SIZE / 2 - 6, 0, Math.PI * 2);
      ctx.fill();
      
      // Add shine effect to jewels
      const gradient = ctx.createRadialGradient(
        -SIZE/6, -SIZE/6, 0,
        0, 0, SIZE/2 - 6
      );
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = gradient;
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

// Get matching jewels
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

// Check if swap is valid
function canSwap(x1, y1, x2, y2) {
  if (y1 !== y2 || Math.abs(x1 - x2) !== 1) return false;
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  const can = getMatches(x1, y1).length >= 3 || getMatches(x2, y2).length >= 3;
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  return can;
}

// Start the game
function startGame() {
  gameState = "game";
  initBoard();
  
  if (musicEnabled) {
    sounds.music.play().catch(e => console.log("Music play error:", e));
  }
}

// Handle mouse down
canvas.addEventListener("mousedown", e => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  if (gameState === "menu") {
    // Check menu buttons
    for (const button of buttons) {
      if (
        mouseX >= button.x - button.width / 2 &&
        mouseX <= button.x + button.width / 2 &&
        mouseY >= button.y - button.height / 2 &&
        mouseY <= button.y + button.height / 2
      ) {
        playSound("button");
        createParticles(mouseX, mouseY, "#fff", 10);
        button.action();
        return;
      }
    }
  } else if (gameState === "settings") {
    // Check settings buttons
    for (const button of settingsButtons) {
      if (
        mouseX >= button.x - button.width / 2 &&
        mouseX <= button.x + button.width / 2 &&
        mouseY >= button.y - button.height / 2 &&
        mouseY <= button.y + button.height / 2
      ) {
        playSound("button");
        createParticles(mouseX, mouseY, "#fff", 10);
        button.action();
        return;
      }
    }
  } else if (gameState === "help") {
    // Check back button
    if (
      mouseX >= canvas.width / 2 - 100 &&
      mouseX <= canvas.width / 2 + 100 &&
      mouseY >= canvas.height - 60 - 25 &&
      mouseY <= canvas.height - 60 + 25
    ) {
      playSound("button");
      createParticles(mouseX, mouseY, "#fff", 10);
      gameState = "menu";
      return;
    }
  } else if (gameState === "paused") {
    // Resume game on click
    gameState = "game";
    return;
  } else if (gameState === "game") {
    // Check menu button in the header
    if (
      mouseX >= 10 &&
      mouseX <= 90 &&
      mouseY >= 5 &&
      mouseY <= 35
    ) {
      playSound("button");
      createParticles(mouseX, mouseY, "#fff", 10);
      gameState = "menu";
      return;
    }
    
    // Game logic - adjusted for header height
    if (animating) return;
    if (mouseY < HEADER_HEIGHT) return; // Ignore clicks in the header area
    
    const x = Math.floor(mouseX / SIZE);
    const y = Math.floor((mouseY - HEADER_HEIGHT) / SIZE);
    
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    
    if (!selected) {
      selected = { x, y };
      playSound("select");
    } else {
      if (canSwap(selected.x, selected.y, x, y)) {
        clearHintIfUsed(selected.x, selected.y, x, y);
        playSound("swap");
        animateSwap(selected.x, selected.y, x, y, () => {
          swapJewels(selected.x, selected.y, x, y, true);
        });
      } else {
        selected = null;
      }
    }
    draw(performance.now());
  }
});

// Handle mouse move
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  // For menu and other screens, track hover position
  hover = { x: mouseX, y: mouseY };
  
  if (gameState === "game") {
    if (animating) return;
    
    // Check if mouse is over the game board
    if (mouseY >= HEADER_HEIGHT) {
      const x = Math.floor(mouseX / SIZE);
      const y = Math.floor((mouseY - HEADER_HEIGHT) / SIZE);
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
        hover = { x, y };
      } else {
        hover = { x: mouseX, y: mouseY };
      }
    }
  }
  
  draw(performance.now());
});

// Handle mouse leave
canvas.addEventListener("mouseleave", () => {
  hover = null;
  draw(performance.now());
});

// Handle keyboard
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (gameState === "game") {
      gameState = "paused";
    } else if (gameState === "paused") {
      gameState = "game";
    }
    draw(performance.now());
  }
});

// Swap jewels
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

// Remove matching jewels
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
    playSound("match");
    popping = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (marks[y][x]) {
          popping.push({ x, y, progress: 0, type: board[y][x] });
          // Create particles at each match location
          createParticles(x * SIZE + SIZE / 2, (y * SIZE + SIZE / 2) + HEADER_HEIGHT, COLORS[board[y][x]], 15);
        }
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

// Animate popping jewels
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

// Animate jewel swap
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

// Animation loop
function animate() {
  draw(performance.now());
  requestAnimationFrame(animate);
}

// Initialize and start game animation
animate();