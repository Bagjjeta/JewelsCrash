// Game with menu and sound effects
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");

// Game constants
const ROWS = 8, COLS = 8, SIZE = 60;
const JEWEL_TYPES = 5;
const COLORS = ["#1abc9c", "#f1c40f", "#e67e22", "#9b59b6", "#e74c3c"];
const POISONED_COLOR = "#2c3e50"; // Dark color for poisoned jewel
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
let gameMode = "classic"; // "classic" or "poisoned"
let movesCounter = 0; // Count moves for poisoned mode
let poisonedJewels = []; // Track poisoned jewels positions
let poisonedMovesLeft = {}; // Track moves left for each poisoned jewel
let poisonedMovesBeforeSpawn = 3; // Spawn poisoned jewel every 10 moves
let poisonedMovesBeforeSpread = 8; // Poisoned jewel spreads after 5 moves

// Sound effects
const sounds = {
  select: new Audio('./sounds/select.mp3'),
  swap: new Audio('./sounds/swap.mp3'),
  match: new Audio('./sounds/match.mp3'),
  hint: new Audio('./sounds/hint.mp3'),
  button: new Audio('./sounds/button_sound.mp3'),
  music: new Audio('./sounds/music.mp3'),
  poisonedMusic: new Audio('./sounds/poisoned_music.mp3'), // New music for poisoned mode
  poison: new Audio('./sounds/poison.mp3') // Sound for poison spread
};

// Preload sounds
Object.values(sounds).forEach(sound => {
  sound.load();
  sound.volume = 0.5;
});

// Background music settings
sounds.music.loop = true;
sounds.music.volume = 0.3;
sounds.poisonedMusic.loop = true;
sounds.poisonedMusic.volume = 0.3;

// Play sounds with check for mute
function playSound(sound) {
  if (soundEnabled && sounds[sound]) {
    // Jeśli to dźwięk podpowiedzi, przerwij poprzednie odtwarzanie (na wypadek szybkiego ponownego użycia)
    if (sound === "hint") {
      sounds.hint.pause();
      sounds.hint.currentTime = 0;
    }
    sounds[sound].currentTime = 0;
    sounds[sound].play().catch(e => console.log("Audio play error:", e));
  }
}

// Toggle background music
function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    playGameMusic();
  } else {
    pauseAllMusic();
  }
}

// Play appropriate music based on game mode
function playGameMusic() {
  if (!musicEnabled) return;
  
  pauseAllMusic();
  
  if (gameMode === "classic") {
    sounds.music.play().catch(e => console.log("Music play error:", e));
  } else if (gameMode === "poisoned") {
    sounds.poisonedMusic.play().catch(e => console.log("Music play error:", e));
  }
}

// Pause all music tracks
function pauseAllMusic() {
  sounds.music.pause();
  sounds.poisonedMusic.pause();
}

// Menu buttons
const buttons = [
  { text: "PLAY", x: canvas.width / 2, y: 200, width: 200, height: 50, action: () => startGame() },
  { text: "SETTINGS", x: canvas.width / 2, y: 270, width: 200, height: 50, action: () => { gameState = "settings"; } },
  { text: "HELP", x: canvas.width / 2, y: 340, width: 200, height: 50, action: () => { gameState = "help"; } }
];

// Settings buttons
const settingsButtons = [
  { text: "SOUND: ON", x: canvas.width / 2, y: 170, width: 240, height: 50, 
    action: () => { 
      soundEnabled = !soundEnabled; 
      settingsButtons[0].text = soundEnabled ? "SOUND: ON" : "SOUND: OFF";
    } 
  },
  { text: "MUSIC: ON", x: canvas.width / 2, y: 240, width: 240, height: 50, 
    action: () => { 
      toggleMusic(); 
      settingsButtons[1].text = musicEnabled ? "MUSIC: ON" : "MUSIC: OFF";
    } 
  },
  { text: "GAME MODE: CLASSIC", x: canvas.width / 2, y: 310, width: 280, height: 50,
    action: () => {
      gameMode = gameMode === "classic" ? "poisoned" : "classic";
      settingsButtons[2].text = `GAME MODE: ${gameMode.toUpperCase()}`;
    }
  },
  { text: "BACK", x: canvas.width / 2, y: 380, width: 200, height: 50, action: () => { gameState = "menu"; } }
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
    // ZATRZYMAJ dźwięk podpowiedzi natychmiast po zniknięciu podpowiedzi
    sounds.hint.pause();
    sounds.hint.currentTime = 0;
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
  
  // Reset poisoned mode variables
  movesCounter = 0;
  poisonedJewels = [];
  poisonedMovesLeft = {};
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
  if (gameMode === "classic") {
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(1, "#16213e");
  } else if (gameMode === "poisoned") {
    gradient.addColorStop(0, "#1e272e");
    gradient.addColorStop(1, "#2c3e50");
  }
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
  const gemSize = 35;
  const gemX = canvas.width / 2 + 140;
  const gemY = 50;
  const gemX2 = canvas.width / 2 - 140;;
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

  ctx.save();
  ctx.translate(gemX2, gemY);
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
  
  // Game mode specific help
  y += 20;
  if (gameMode === "classic") {
    ctx.fillText("CLASSIC MODE:", 80, y);
    y += lineHeight;
    ctx.fillText("- Standard match-3 gameplay", 80, y);
  } else if (gameMode === "poisoned") {
    ctx.fillText("POISONED JEWELS MODE:", 80, y);
    y += lineHeight;
    ctx.fillText("- Every 10 moves, a poisoned jewel appears", 80, y);
    y += lineHeight;
    ctx.fillText("- Remove it within 5 moves or it will spread", 80, y);
    y += lineHeight;
    ctx.fillText("- If poisoned jewels fill the board, you lose", 80, y);
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
  
  // Draw mode info or poisoned moves counter
  if (gameMode === "poisoned") {
    let nextPoisonIn = poisonedMovesBeforeSpawn - (movesCounter % poisonedMovesBeforeSpawn);
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Poisoned in: ${nextPoisonIn}`, canvas.width - 20, HEADER_HEIGHT / 2 + 5);
  } else {
    // Draw pause info on the right
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText("ESC - Pause", canvas.width - 20, HEADER_HEIGHT / 2 + 5);
  }
  
  // Draw popping jewels
  for (let p of popping) {
    let scale = 1 + 0.2 * Math.sin(Math.PI * p.progress);
    let alpha = 1 - p.progress;
    let jewel = board[p.y][p.x] !== undefined ? board[p.y][p.x] : p.type;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x * SIZE + SIZE / 2, p.y * SIZE + SIZE / 2 + HEADER_HEIGHT);
    ctx.scale(scale, scale);
    
    // Check if it's a poisoned jewel
    if (isPoisonedJewel(p.x, p.y)) {
      ctx.fillStyle = POISONED_COLOR;
    } else {
      ctx.fillStyle = COLORS[jewel];
    }
    
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
    
    // Check if it's a poisoned jewel
    if (isPoisonedJewel(x1, y1)) {
      ctx.fillStyle = POISONED_COLOR;
      // Add poison symbol (skull)
      drawPoisonedJewel(0, 0, SIZE / 2 - 6);
    } else {
      ctx.fillStyle = COLORS[j1];
    }
    
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
    
    // Check if it's a poisoned jewel
    if (isPoisonedJewel(x2, y2)) {
      ctx.fillStyle = POISONED_COLOR;
      // Add poison symbol (skull)
      drawPoisonedJewel(0, 0, SIZE / 2 - 6);
    } else {
      ctx.fillStyle = COLORS[j2];
    }
    
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
      
      // Poison warning pulse if about to spread
      const poisonKey = `${x},${y}`;
      if (
        gameMode === "poisoned" && 
        isPoisonedJewel(x, y) && 
        poisonedMovesLeft[poisonKey] <= 2
      ) {
        scale = 1.15 + 0.1 * Math.sin(now / 200);
        shadow = true;
      }
      
      ctx.save();
      ctx.translate(x * SIZE + SIZE / 2, y * SIZE + SIZE / 2 + HEADER_HEIGHT);
      ctx.scale(scale, scale);
      if (shadow) {
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 15;
      }
      
      // Check if it's a poisoned jewel
      if (isPoisonedJewel(x, y)) {
        ctx.fillStyle = POISONED_COLOR;
      } else {
        ctx.fillStyle = COLORS[jewel];
      }
      
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
      
      // Draw poison symbol for poisoned jewels
      if (isPoisonedJewel(x, y)) {
        drawPoisonedJewel(0, 0, SIZE / 2 - 6);
      }
      
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
      
      // Indication for poisoned jewels about to spread
      if (
        gameMode === "poisoned" && 
        isPoisonedJewel(x, y)
      ) {
        const poisonKey = `${x},${y}`;
        // Show moves remaining
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(poisonedMovesLeft[poisonKey], 0, 0);
        
        // Add warning glow if about to spread
        if (poisonedMovesLeft[poisonKey] <= 2) {
          ctx.strokeStyle = "#ff0000";
          ctx.lineWidth = 3;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      
      ctx.restore();
    }
  }
}

// Draw a poisoned jewel (with skull symbol)
function drawPoisonedJewel(x, y, radius) {
  ctx.save();
  ctx.translate(x, y);
  
  // Draw skull symbol
  ctx.fillStyle = "#fff";
  
  // Skull head
  ctx.beginPath();
  ctx.arc(0, -radius/4, radius/2, 0, Math.PI * 2);
  ctx.fill();
  
  // Eyes
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(-radius/5, -radius/4, radius/8, 0, Math.PI * 2);
  ctx.arc(radius/5, -radius/4, radius/8, 0, Math.PI * 2);
  ctx.fill();
  
  // Nose
  ctx.beginPath();
  ctx.arc(0, -radius/6, radius/10, 0, Math.PI * 2);
  ctx.fill();
  
  // Jaw
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, radius/6, radius/3, 0, Math.PI);
  ctx.fill();
  
  // Teeth
  ctx.fillStyle = "#000";
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(i * radius/8, radius/12, radius/10, radius/6);
  }
  
  ctx.restore();
}

// Check if a position has a poisoned jewel
function isPoisonedJewel(x, y) {
  return poisonedJewels.some(pos => pos.x === x && pos.y === y);
}

// Add a poisoned jewel to the board
function addPoisonedJewel() {
  if (gameMode !== "poisoned") return;
  
  // Find empty positions (not already poisoned)
  let emptyPositions = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!isPoisonedJewel(x, y)) {
        emptyPositions.push({x, y});
      }
    }
  }
  
  if (emptyPositions.length > 0) {
    // Choose random position
    const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    poisonedJewels.push(pos);
    const poisonKey = `${pos.x},${pos.y}`;
    poisonedMovesLeft[poisonKey] = poisonedMovesBeforeSpread;
    
    // Play poison sound
    playSound("poison");
    
    // Create particle effect
    createParticles(
      pos.x * SIZE + SIZE / 2, 
      pos.y * SIZE + SIZE / 2 + HEADER_HEIGHT, 
      POISONED_COLOR, 
      30
    );
  }
}

// Update poisoned jewels (reduce their countdown, spread if needed)
function updatePoisonedJewels() {
  if (gameMode !== "poisoned") return;
  
  let spread = false;
  let newPoisonedPositions = [];
  
  // Check if any poisoned jewel needs to spread
  for (let i = 0; i < poisonedJewels.length; i++) {
    const pos = poisonedJewels[i];
    const poisonKey = `${pos.x},${pos.y}`;
    
    if (poisonedMovesLeft[poisonKey] <= 0) {
      spread = true;
      
      // Spread to adjacent cells (4 directions)
      const directions = [
        {dx: 1, dy: 0},
        {dx: -1, dy: 0},
        {dx: 0, dy: 1},
        {dx: 0, dy: -1}
      ];
      
      for (const dir of directions) {
        const newX = pos.x + dir.dx;
        const newY = pos.y + dir.dy;
        
        // Check if position is valid and not already poisoned
        if (
          newX >= 0 && newX < COLS && 
          newY >= 0 && newY < ROWS &&
          !isPoisonedJewel(newX, newY) &&
          !newPoisonedPositions.some(p => p.x === newX && p.y === newY)
        ) {
          newPoisonedPositions.push({x: newX, y: newY});
        }
      }
      
      // Reset the moves counter for this poisoned jewel
      poisonedMovesLeft[poisonKey] = poisonedMovesBeforeSpread;
    }
  }
  
  // Add new poisoned positions
  for (const newPos of newPoisonedPositions) {
    poisonedJewels.push(newPos);
    const poisonKey = `${newPos.x},${newPos.y}`;
    poisonedMovesLeft[poisonKey] = poisonedMovesBeforeSpread;
    
    // Create particle effect
    createParticles(
      newPos.x * SIZE + SIZE / 2, 
      newPos.y * SIZE + SIZE / 2 + HEADER_HEIGHT, 
      POISONED_COLOR, 
      15
    );
  }
  
  if (spread) {
    playSound("poison");
  }
  
  // Check for game over - if all board is poisoned
  if (poisonedJewels.length >= ROWS * COLS) {
    gameOver();
  }
}

// Game over
function gameOver() {
  animating = true;
  
  // Draw game over screen
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);
  
  ctx.font = "24px Arial";
  ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
  
  // Draw retry button
  const retryButton = { 
    text: "RETRY", 
    x: canvas.width / 2, 
    y: canvas.height / 2 + 80, 
    width: 200, 
    height: 50, 
    action: () => {
      startGame();
    }
  };
  
  drawButton(retryButton, hover && 
    hover.x >= retryButton.x - retryButton.width / 2 &&
    hover.x <= retryButton.x + retryButton.width / 2 &&
    hover.y >= retryButton.y - retryButton.height / 2 &&
    hover.y <= retryButton.y + retryButton.height / 2
  );
  
  // Add event listener for clicking retry button
  const retryListener = function(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    if (
      mouseX >= retryButton.x - retryButton.width / 2 &&
      mouseX <= retryButton.x + retryButton.width / 2 &&
      mouseY >= retryButton.y - retryButton.height / 2 &&
      mouseY <= retryButton.y + retryButton.height / 2
    ) {
      playSound("button");
      canvas.removeEventListener("mousedown", retryListener);
      retryButton.action();
    }
  };
  
  canvas.addEventListener("mousedown", retryListener);
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
  playGameMusic();
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
      // ZATRZYMAJ dźwięk podpowiedzi natychmiast po zniknięciu podpowiedzi (na wszelki wypadek)
      sounds.hint.pause();
      sounds.hint.currentTime = 0;
      // Update lastMoveTime after a successful match
      lastMoveTime = Date.now();
      // Reset timer to wait another 20 seconds
      scheduleHintTimer();
      
      // Increment moves counter for poisoned mode
      if (gameMode === "poisoned") {
        incrementPoisonedMoves();
      }
      
      selected = null;
      animating = false;
      draw(performance.now());
    }
  }, animate ? 200 : 0);
}

// Increment moves counter in poisoned mode
function incrementPoisonedMoves() {
  movesCounter++;
  
  // Add poisoned jewel every X moves
  if (movesCounter % poisonedMovesBeforeSpawn === 0) {
    addPoisonedJewel();
  }
  
  // Update poisoned jewels countdown
  for (const pos of poisonedJewels) {
    const poisonKey = `${pos.x},${pos.y}`;
    poisonedMovesLeft[poisonKey]--;
  }
  
  // Update poisoned jewels (check for spread)
  updatePoisonedJewels();
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
    // NOWA LOGIKA: Sprawdź zatrute klejnoty sąsiadujące z jakimkolwiek dopasowanym klejnotem
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (marks[r][c]) { // Jeżeli klejnot w (r,c) jest częścią dopasowania
          const neighbors = [
            { x: c, y: r - 1 }, // góra
            { x: c, y: r + 1 }, // dół
            { x: c - 1, y: r }, // lewo
            { x: c + 1, y: r }  // prawo
          ];
          for (const n of neighbors) {
            if (n.x >= 0 && n.x < COLS && n.y >= 0 && n.y < ROWS) { // Sprawdź granice planszy
              if (isPoisonedJewel(n.x, n.y) && !marks[n.y][n.x]) {
                // Znaleziono zatruty klejnot sąsiadujący z dopasowaniem, który nie jest jeszcze oznaczony do usunięcia
                marks[n.y][n.x] = true; // Oznacz go do usunięcia
              }
            }
          }
        }
      }
    }
    // KONIEC NOWEJ LOGIKI SĄSIEDZTWA

    playSound("match");
    popping = [];
    
    let poisonedRemovedThisTurn = false; 
    let countPoisonedRemovedThisTurn = 0; 

    for (let i = poisonedJewels.length - 1; i >= 0; i--) {
      const pos = poisonedJewels[i];
      if (marks[pos.y][pos.x]) { 
        poisonedJewels.splice(i, 1);
        delete poisonedMovesLeft[`${pos.x},${pos.y}`]; 
        poisonedRemovedThisTurn = true;
        countPoisonedRemovedThisTurn++; 
      }
    }
    
    if (poisonedRemovedThisTurn) {
      createParticles(canvas.width / 2, canvas.height / 2, POISONED_COLOR, 30);
    }
    
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (marks[y][x]) {
          popping.push({ x, y, progress: 0, type: board[y][x] });
          createParticles(x * SIZE + SIZE / 2, (y * SIZE + SIZE / 2) + HEADER_HEIGHT, 
                         isPoisonedJewel(x, y) ? POISONED_COLOR : COLORS[board[y][x]], 15);
        }
      }
    }

    animatePop(() => {
      let basePointsFromMatches = 0;
      let newBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); 

      for (let x = 0; x < COLS; x++) {
        let col = [];
        for (let y = ROWS - 1; y >= 0; y--) {
          if (marks[y][x]) { 
            basePointsFromMatches+=50;
          } else {
            col.push(board[y][x]);
          }
        }
        for (let y = ROWS - 1; y >= 0; y--) {
          if (col.length > 0) {
            newBoard[y][x] = col.pop();
          } else {
            newBoard[y][x] = Math.floor(Math.random() * COLORS.length);
          }
        }
      }
      
      score += basePointsFromMatches + countPoisonedRemovedThisTurn * (basePointsFromMatches * 2);
      scoreDiv.textContent = "Wynik: " + score; // POPRAWIONA LINIA

      board = newBoard; 

      // Po ponownym zapełnieniu, sprawdź nowe dopasowania (kaskady)
      // W twoim oryginalnym kodzie było setTimeout(removeMatches, 150) wewnątrz animatePop.
      // Aby zachować podobną logikę kaskad, wywołujemy checkMatches, które powinno obsłużyć dalsze dopasowania.
      // Zakładam, że potrzebujesz funkcji checkMatches, która wywoła removeMatches jeśli znajdzie nowe dopasowania.
      // Jeśli checkMatches nie istnieje lub działa inaczej, ten fragment może wymagać dostosowania.
      // Na podstawie twojego kodu `swapJewels` i `removeMatches`, wydaje się, że `removeMatches` jest rekursywne przez setTimeout.
      // Możemy zachować tę logikę, ale upewnijmy się, że popping jest czyszczone przed ponownym wywołaniem.
      popping = []; // Wyczyść popping przed potencjalną kaskadą
      setTimeout(() => {
        draw(performance.now()); // Odrysuj przed sprawdzeniem kaskady
        removeMatches(); // Sprawdź kaskadowe dopasowania
      }, 150); // Niewielkie opóźnienie dla płynności
      
      // Jeśli wolisz, aby `checkMatches` było główną funkcją kontrolującą kaskady:
      checkMatches(true); // true dla animacji, jeśli masz taką funkcję

    }, 300); 
  }
  // Zwróć true, jeśli jakiekolwiek klejnoty zostały usunięte, false w przeciwnym razie.
  // Jest to ważne dla logiki w `swapJewels`, aby wiedzieć, czy cofnąć ruch.
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
animate();

// DODANO: automatyczne rozpoczęcie muzyki na starcie gry (jeśli wymagane)
let musicStarted = false;
function tryStartMusic() {
  if (!musicStarted && musicEnabled) {
    playGameMusic();
    musicStarted = true;
  }
}
document.addEventListener("mousedown", tryStartMusic, { once: true });