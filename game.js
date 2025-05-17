// Game with menu and sound effects
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");

// Game constants
const ROWS = 8;
const COLS = 8;
const SIZE = 75; // ZMIENIONO: Rozmiar pola klejnotu (np. 75)
const JEWEL_TYPES = 5;
const HEADER_HEIGHT = 40;
const JEWEL_VISUAL_SCALE = 0.85; // NOWA STAŁA: Skala obrazka klejnotu wewnątrz jego pola (np. 0.85)

// Image paths and objects
const jewelImagePaths = [
  'icon/blue.png',
  'icon/yellow.png',
  'icon/green.png',
  'icon/red.png',
  'icon/purple.png'
];
const poisonImagePath = 'icon/poison.png';

let jewelImages = [];
let poisonImage = new Image();
let imagesToLoad = jewelImagePaths.length + 1;
let imagesLoadedCount = 0;
let allImagesReady = false;

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
let movesCounter = 0;
let poisonedJewels = [];
let poisonedMovesLeft = {};
let poisonedMovesBeforeSpawn = 3;
let poisonedMovesBeforeSpread = 8;

// Sound effects
const sounds = {
  select: new Audio('./sounds/select.mp3'),
  swap: new Audio('./sounds/swap.mp3'),
  match: new Audio('./sounds/match.mp3'),
  hint: new Audio('./sounds/hint.mp3'),
  button: new Audio('./sounds/button_sound.mp3'),
  music: new Audio('./sounds/music.mp3'),
  poisonedMusic: new Audio('./sounds/poisoned_music.mp3'),
  poison: new Audio('./sounds/poison.mp3')
};

Object.values(sounds).forEach(sound => {
  sound.load();
  sound.volume = 0.5;
});
sounds.music.loop = true;
sounds.music.volume = 0.3;
sounds.poisonedMusic.loop = true;
sounds.poisonedMusic.volume = 0.3;

function loadJewelImages(callback) {
  jewelImagePaths.forEach((path, i) => {
    const img = new Image();
    img.src = path;
    jewelImages[i] = img;
    img.onload = () => {
      imagesLoadedCount++;
      if (imagesLoadedCount === imagesToLoad && callback) {
        allImagesReady = true; // Ustaw flagę tutaj
        callback();
      }
    };
    img.onerror = () => {
      console.error("Failed to load image:", path);
      imagesLoadedCount++;
      if (imagesLoadedCount === imagesToLoad && callback) {
        allImagesReady = true; // Również tutaj na wypadek błędu
        callback();
      }
    };
  });

  poisonImage.src = poisonImagePath;
  poisonImage.onload = () => {
    imagesLoadedCount++;
    if (imagesLoadedCount === imagesToLoad && callback) {
      allImagesReady = true;
      callback();
    }
  };
  poisonImage.onerror = () => {
    console.error("Failed to load image:", poisonImagePath);
    imagesLoadedCount++;
    if (imagesLoadedCount === imagesToLoad && callback) {
      allImagesReady = true;
      callback();
    }
  };
}

function playSound(sound) {
  if (soundEnabled && sounds[sound]) {
    if (sound === "hint") {
      sounds.hint.pause();
      sounds.hint.currentTime = 0;
    }
    sounds[sound].currentTime = 0;
    sounds[sound].play().catch(e => console.log("Audio play error:", e));
  }
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  if (musicEnabled) {
    playGameMusic();
  } else {
    pauseAllMusic();
  }
}

function playGameMusic() {
  if (!musicEnabled) {
    return;
  }
  pauseAllMusic();
  if (gameMode === "classic") {
    sounds.music.play().catch(e => console.log("Music play error:", e));
  } else if (gameMode === "poisoned") {
    sounds.poisonedMusic.play().catch(e => console.log("Music play error:", e));
  }
}

function pauseAllMusic() {
  sounds.music.pause();
  sounds.poisonedMusic.pause();
}

const buttons = [
  { text: "PLAY", x: canvas.width / 2, y: 200, width: 200, height: 50, action: () => startGame() },
  { text: "SETTINGS", x: canvas.width / 2, y: 270, width: 200, height: 50, action: () => { gameState = "settings"; } },
  { text: "HELP", x: canvas.width / 2, y: 340, width: 200, height: 50, action: () => { gameState = "help"; } }
];

const settingsButtons = [
  {
    text: "SOUND: ON", x: canvas.width / 2, y: 170, width: 240, height: 50,
    action: () => {
      soundEnabled = !soundEnabled;
      settingsButtons[0].text = soundEnabled ? "SOUND: ON" : "SOUND: OFF";
    }
  },
  {
    text: "MUSIC: ON", x: canvas.width / 2, y: 240, width: 240, height: 50,
    action: () => {
      toggleMusic();
      settingsButtons[1].text = musicEnabled ? "MUSIC: ON" : "MUSIC: OFF";
    }
  },
  {
    text: "GAME MODE: CLASSIC", x: canvas.width / 2, y: 310, width: 280, height: 50,
    action: () => {
      gameMode = gameMode === "classic" ? "poisoned" : "classic";
      settingsButtons[2].text = `GAME MODE: ${gameMode.toUpperCase()}`;
    }
  },
  { text: "BACK", x: canvas.width / 2, y: 380, width: 200, height: 50, action: () => { gameState = "menu"; } }
];

function scheduleHintTimer() {
  if (hintTimer) {
    clearTimeout(hintTimer);
  }
  hintTimer = setTimeout(checkAndShowHint, 20000);
}

function checkAndShowHint() {
  const now = Date.now();
  if (now - lastMoveTime >= 20000 && !hintCell && gameState === "game") {
    showHint();
  } else {
    hintTimer = setTimeout(checkAndShowHint, 1000);
  }
}

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
}

function findFirstPossibleMove() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (canSwapAndMatch(x, y, x + 1, y)) {
        return { x, y, x2: x + 1, y2: y };
      }
    }
  }
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS - 1; y++) {
      if (canSwapAndMatch(x, y, x, y + 1)) {
        return { x, y, x2: x, y2: y + 1 };
      }
    }
  }
  return null;
}

function clearHintIfUsed(x1, y1, x2, y2) {
  if (hintCell && hintPair &&
    (((hintCell.x === x1 && hintCell.y === y1) && (hintPair.x === x2 && hintPair.y === y2)) ||
     ((hintCell.x === x2 && hintCell.y === y2) && (hintPair.x === x1 && hintPair.y === y1)))) {
    hintCell = null;
    hintPair = null;
    sounds.hint.pause();
    sounds.hint.currentTime = 0;
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
  if (hintTimer) {
    clearTimeout(hintTimer);
  }
  hintCell = null;
  hintPair = null;
  lastMoveTime = Date.now();
  scheduleHintTimer();
  score = 0;
  if (scoreDiv) {
    scoreDiv.textContent = "Wynik: 0";
  }
  movesCounter = 0;
  poisonedJewels = [];
  poisonedMovesLeft = {};
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
  if (!allImagesReady) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(1, "#16213e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "20px Arial";
    ctx.fillText("Wczytywanie klejnotów...", canvas.width / 2, canvas.height / 2);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradientBg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  if (gameMode === "classic") {
    gradientBg.addColorStop(0, "#1a1a2e");
    gradientBg.addColorStop(1, "#16213e");
  } else if (gameMode === "poisoned") {
    gradientBg.addColorStop(0, "#1e272e");
    gradientBg.addColorStop(1, "#2c3e50");
  }
  ctx.fillStyle = gradientBg;
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
  drawParticles();
}

function drawParticles() {
  for (let i = particleEffects.length - 1; i >= 0; i--) {
    const p = particleEffects[i];
    p.life -= 0.02;
    p.x += p.vx;
    p.y += p.vy;
    p.size *= 0.95;
    if (p.life <= 0 || p.size < 0.5) {
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

function createParticles(x, y, color, count = 20) {
  for (let i = 0; i < count; i++) {
    particleEffects.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      size: Math.random() * 5 + 2,
      color: color || (jewelImages.length > 0 ? jewelImages[Math.floor(Math.random() * jewelImages.length)].src : 'gray'),
      life: 1
    });
  }
}

function drawMenu(now) {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("JEWELS CRASH", canvas.width / 2, 120);

  const gemSize = 35;
  const gemX = canvas.width / 2 + 140;
  const gemY = 70; // Adjusted Y
  const gemX2 = canvas.width / 2 - 140;
  const pulse = 1 + 0.1 * Math.sin(now / 200);

  if (allImagesReady && jewelImages.length > 0) {
    const imgIndex = Math.floor(now / 500) % jewelImages.length;
    const imgToDraw = jewelImages[imgIndex];
    if (imgToDraw && imgToDraw.complete) {
      ctx.save();
      ctx.translate(gemX, gemY);
      ctx.scale(pulse, pulse);
      ctx.drawImage(imgToDraw, -gemSize / 2, -gemSize / 2, gemSize, gemSize);
      // Obramowanie usunięte: ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.strokeRect(-gemSize/2, -gemSize/2, gemSize, gemSize);
      ctx.restore();

      ctx.save();
      ctx.translate(gemX2, gemY);
      ctx.scale(pulse, pulse);
      ctx.drawImage(imgToDraw, -gemSize / 2, -gemSize / 2, gemSize, gemSize);
      // Obramowanie usunięte
      ctx.restore();
    }
  }

  for (const button of buttons) {
    const isHovered = hover &&
                      hover.x >= button.x - button.width / 2 &&
                      hover.x <= button.x + button.width / 2 &&
                      hover.y >= button.y - button.height / 2 &&
                      hover.y <= button.y + button.height / 2;
    drawButton(button, isHovered);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "15px Arial";
  ctx.fillText("© 2025 Bagjjeta", canvas.width / 2, canvas.height - 20);
}

function drawSettings(now) {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SETTINGS", canvas.width / 2, 120);
  for (const button of settingsButtons) {
    const isHovered = hover &&
                      hover.x >= button.x - button.width / 2 &&
                      hover.x <= button.x + button.width / 2 &&
                      hover.y >= button.y - button.height / 2 &&
                      hover.y <= button.y + button.height / 2;
    drawButton(button, isHovered);
  }
}

function drawHelp() {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("HOW TO PLAY", canvas.width / 2, 80);

  ctx.font = "16px Arial";
  ctx.textAlign = "left";
  const lineHeight = 25;
  let yPos = 130;
  const helpText = [
    "1. Swap adjacent jewels to create matches of 3 or more",
    "2. Matches must be in a horizontal or vertical line",
    "3. Create matches to score points",
    "4. If you get stuck, wait for a hint to appear",
    "5. Press ESC to pause the game"
  ];
  for (const line of helpText) {
    ctx.fillText(line, 80, yPos);
    yPos += lineHeight;
  }
  yPos += 20;

  if (gameMode === "classic") {
    ctx.fillText("CLASSIC MODE:", 80, yPos);
    yPos += lineHeight;
    ctx.fillText("- Standard match-3 gameplay", 80, yPos);
  } else if (gameMode === "poisoned") {
    ctx.fillText("POISONED JEWELS MODE:", 80, yPos);
    yPos += lineHeight;
    ctx.fillText(`- Every ${poisonedMovesBeforeSpawn} moves, a poisoned jewel appears`, 80, yPos);
    yPos += lineHeight;
    ctx.fillText(`- Remove it within ${poisonedMovesBeforeSpread} moves or it will spread`, 80, yPos);
    yPos += lineHeight;
    ctx.fillText("- If poisoned jewels fill the board, you lose", 80, yPos);
    yPos += lineHeight;
    ctx.fillText("- Poisoned jewels give 2x points (20 points)", 80, yPos);
    yPos += lineHeight;
    ctx.fillText("- Poisoned jewels are removed if matched OR if an adjacent match occurs", 80, yPos);
  }

  const backButtonConfig = {
    text: "BACK",
    x: canvas.width / 2,
    y: canvas.height - 60,
    width: 200,
    height: 50,
    action: () => { gameState = "menu"; }
  };
  const isBackHovered = hover &&
                        hover.x >= backButtonConfig.x - backButtonConfig.width / 2 &&
                        hover.x <= backButtonConfig.x + backButtonConfig.width / 2 &&
                        hover.y >= backButtonConfig.y - backButtonConfig.height / 2 &&
                        hover.y <= backButtonConfig.y + backButtonConfig.height / 2;
  drawButton(backButtonConfig, isBackHovered);
}

function drawButton(button, isHovered) {
  const x = button.x;
  const y = button.y;
  const width = button.width;
  const height = button.height;
  const cornerRadius = 10;

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

  ctx.beginPath();
  ctx.moveTo(x - width / 2 + cornerRadius, y - height / 2);
  ctx.lineTo(x + width / 2 - cornerRadius, y - height / 2);
  ctx.quadraticCurveTo(x + width / 2, y - height / 2, x + width / 2, y - height / 2 + cornerRadius);
  ctx.lineTo(x + width / 2, y + height / 2 - cornerRadius);
  ctx.quadraticCurveTo(x + width / 2, y + height / 2, x + width / 2 - cornerRadius, y + height / 2);
  ctx.lineTo(x - width / 2 + cornerRadius, y + height / 2);
  ctx.quadraticCurveTo(x - width / 2, y + height / 2, x - width / 2, y + height / 2 - cornerRadius);
  ctx.lineTo(x - width / 2, y - height / 2 + cornerRadius);
  ctx.quadraticCurveTo(x - width / 2, y - height / 2, x - width / 2 + cornerRadius, y - height / 2);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(button.text, x, y);

  if (isHovered) {
    ctx.shadowColor = "#4a69bd";
    ctx.shadowBlur = 15;
    ctx.stroke(); // Re-stroke for shadowed stroke
    ctx.shadowBlur = 0;
  }
}

function drawGame(now) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, HEADER_HEIGHT);

  const menuButtonConfig = {
    text: "MENU", x: 50, y: HEADER_HEIGHT / 2, width: 80, height: 30,
    action: () => { gameState = "menu"; pauseAllMusic(); playGameMusic(); }
  };
  const isMenuButtonHovered = hover && hover.x >= 10 && hover.x <= 90 && hover.y >= 5 && hover.y <= 35;
  drawButton(menuButtonConfig, isMenuButtonHovered);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  if (scoreDiv) {
    ctx.fillText("Score: " + score, canvas.width / 2, HEADER_HEIGHT / 2 + 5);
  }

  if (gameMode === "poisoned") {
    let nextPoisonIn = poisonedMovesBeforeSpawn - (movesCounter % poisonedMovesBeforeSpawn);
    ctx.font = "14px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Poison in: ${nextPoisonIn}`, canvas.width - 20, HEADER_HEIGHT / 2 + 5);
  } else {
    ctx.font = "16px Arial";
    ctx.textAlign = "right";
    ctx.fillText("ESC - Pause", canvas.width - 20, HEADER_HEIGHT / 2 + 5);
  }

  popping.forEach(p => {
    let scale = 1 + 0.2 * Math.sin(Math.PI * p.progress);
    let alpha = 1 - p.progress;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x * SIZE + SIZE / 2, p.y * SIZE + SIZE / 2 + HEADER_HEIGHT);
    ctx.scale(scale, scale);

    let imgToPop = null;
    if (p.wasPoison && poisonImage && poisonImage.complete) {
      imgToPop = poisonImage;
    } else if (!p.wasPoison && p.type >= 0 && p.type < jewelImages.length && jewelImages[p.type] && jewelImages[p.type].complete) {
      imgToPop = jewelImages[p.type];
    }
    
    const jewelDrawSizePop = SIZE * JEWEL_VISUAL_SCALE;
    if (imgToPop) {
      ctx.drawImage(imgToPop, -jewelDrawSizePop / 2, -jewelDrawSizePop / 2, jewelDrawSizePop, jewelDrawSizePop);
    } else {
      ctx.fillStyle = `rgba(128,128,128,${alpha})`;
      ctx.fillRect(-jewelDrawSizePop / 2, -jewelDrawSizePop / 2, jewelDrawSizePop, jewelDrawSizePop);
    }
    ctx.restore();
  });

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (popping.some(p => p.x === x && p.y === y)) {
        continue;
      }
      if (swapAnim && ((swapAnim.x1 === x && swapAnim.y1 === y) || (swapAnim.x2 === x && swapAnim.y2 === y))) {
           continue;
      }
      
      let jewelType = board[y][x];
      let currentScale = 1; 
      const poisonKey = `${x},${y}`;

      if (selected && selected.x === x && selected.y === y) {
        currentScale = 1.2 + 0.04 * Math.sin(now / 120);
      } else if (hover && hover.x === x && hover.y === y && !animating) {
        currentScale = 1.1;
      } else if (hintCell && hintPair && ((hintCell.x === x && hintCell.y === y) || (hintPair.x === x && hintPair.y === y)) && !selected && !animating) {
        currentScale = 1.15 + 0.03 * Math.sin(now / 80);
      } else if (gameMode === "poisoned" && isPoisonedJewel(x, y) && poisonedMovesLeft[poisonKey] <= 2) {
        currentScale = 1.15 + 0.1 * Math.sin(now / 200);
      }
      
      ctx.save();
      ctx.translate(x * SIZE + SIZE / 2, y * SIZE + SIZE / 2 + HEADER_HEIGHT);
      ctx.scale(currentScale, currentScale);

      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent'; 

      if (selected && selected.x === x && selected.y === y) {
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 4;
      } else if (hover && hover.x === x && hover.y === y && !animating) {
        ctx.shadowColor = "#FFFFFF";
        ctx.shadowBlur = 2;
      } else if (hintCell && hintPair && ((hintCell.x === x && hintCell.y === y) || (hintPair.x === x && hintPair.y === y)) && !selected && !animating) {
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 3;
      } else if (gameMode === "poisoned" && isPoisonedJewel(x, y) && poisonedMovesLeft[poisonKey] <= 2) {
        ctx.shadowColor = "#FF0000";
        ctx.shadowBlur = 3;
      }
      
      let currentJewelImage = null;
      if (isPoisonedJewel(x, y)) {
        currentJewelImage = poisonImage;
      } else if (jewelType >= 0 && jewelType < jewelImages.length) {
        currentJewelImage = jewelImages[jewelType];
      }

      const jewelDrawSize = SIZE * JEWEL_VISUAL_SCALE;
      if (currentJewelImage && currentJewelImage.complete) {
        ctx.drawImage(currentJewelImage, -jewelDrawSize / 2, -jewelDrawSize / 2, jewelDrawSize, jewelDrawSize);
      } else {
        ctx.fillStyle = 'grey';
        ctx.fillRect(-jewelDrawSize / 2, -jewelDrawSize / 2, jewelDrawSize, jewelDrawSize);
      }
      
      if (gameMode === "poisoned" && isPoisonedJewel(x, y)) {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2; 
        ctx.strokeText(poisonedMovesLeft[poisonKey], 0, 0); 
        ctx.fillText(poisonedMovesLeft[poisonKey], 0, 0);
      }
      ctx.restore(); 
    }
  }
}

function isPoisonedJewel(x, y) {
  return poisonedJewels.some(pos => pos.x === x && pos.y === y);
}

function addPoisonedJewel() {
  if (gameMode !== "poisoned") {
    return;
  }
  let emptyPositions = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!isPoisonedJewel(x, y)) {
        emptyPositions.push({x, y});
      }
    }
  }
  if (emptyPositions.length > 0) {
    const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    poisonedJewels.push(pos);
    poisonedMovesLeft[`${pos.x},${pos.y}`] = poisonedMovesBeforeSpread;
    playSound("poison");
    createParticles(pos.x * SIZE + SIZE / 2, pos.y * SIZE + SIZE / 2 + HEADER_HEIGHT, "rgba(44, 62, 80, 0.8)", 30);
  }
}

function updatePoisonedJewels() {
  if (gameMode !== "poisoned") {
    return;
  }
  let spreadOccurred = false;
  let newPoisonedPositions = [];
  for (let i = 0; i < poisonedJewels.length; i++) {
    const pos = poisonedJewels[i];
    const poisonKey = `${pos.x},${pos.y}`;
    if (poisonedMovesLeft[poisonKey] <= 0) {
      spreadOccurred = true;
      const directions = [{dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}];
      for (const dir of directions) {
        const newX = pos.x + dir.dx;
        const newY = pos.y + dir.dy;
        if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS &&
            !isPoisonedJewel(newX, newY) &&
            !newPoisonedPositions.some(p => p.x === newX && p.y === newY)) {
          newPoisonedPositions.push({x: newX, y: newY});
        }
      }
      poisonedMovesLeft[poisonKey] = poisonedMovesBeforeSpread;
    }
  }
  for (const newPos of newPoisonedPositions) {
    if (!isPoisonedJewel(newPos.x, newPos.y)) {
      poisonedJewels.push(newPos);
      poisonedMovesLeft[`${newPos.x},${newPos.y}`] = poisonedMovesBeforeSpread;
      createParticles(newPos.x * SIZE + SIZE / 2, newPos.y * SIZE + SIZE / 2 + HEADER_HEIGHT, "rgba(44, 62, 80, 0.8)", 15);
    }
  }
  if (spreadOccurred) {
    playSound("poison");
  }
  if (poisonedJewels.length >= ROWS * COLS) {
    gameOver();
  }
}

function gameOver() {
  animating = true;
  gameState = "gameover";
  pauseAllMusic();
  setTimeout(() => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "24px Arial";
    if (scoreDiv) {
      ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20);
    }
    const retryButton = {
      text: "RETRY", x: canvas.width / 2, y: canvas.height / 2 + 80, width: 200, height: 50,
      action: () => { startGame(); }
    };
    drawButton(retryButton, false);
    canvas.addEventListener("mousedown", gameOverClickListener);
  }, 500);
}

function gameOverClickListener(e) {
  if (gameState !== "gameover") {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  const retryButton = { x: canvas.width / 2, y: canvas.height / 2 + 80, width: 200, height: 50 };
  if (mouseX >= retryButton.x - retryButton.width / 2 && mouseX <= retryButton.x + retryButton.width / 2 &&
      mouseY >= retryButton.y - retryButton.height / 2 && mouseY <= retryButton.y + retryButton.height / 2) {
    playSound("button");
    canvas.removeEventListener("mousedown", gameOverClickListener);
    startGame();
  }
}

function getMatches(x, y) {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS || board[y][x] === null) {
    return [];
  }
  const jewel = board[y][x];
  let horiz = [{ x, y }];
  let vert = [{ x, y }];

  for (let dx = x - 1; dx >= 0 && board[y][dx] === jewel; dx--) {
    horiz.push({ x: dx, y });
  }
  for (let dx = x + 1; dx < COLS && board[y][dx] === jewel; dx++) {
    horiz.push({ x: dx, y });
  }
  for (let dy = y - 1; dy >= 0 && board[dy] && board[dy][x] === jewel; dy--) {
    vert.push({ x, y: dy });
  }
  for (let dy = y + 1; dy < ROWS && board[dy] && board[dy][x] === jewel; dy++) {
    vert.push({ x, y: dy });
  }

  let result = [];
  if (horiz.length >= 3) {
    result = result.concat(horiz);
  }
  if (vert.length >= 3) {
    result = result.concat(vert);
  }
  return result.filter((v, i, a) => a.findIndex(t => t.x === v.x && t.y === v.y) === i);
}

function canSwapAndMatch(x1, y1, x2, y2) {
  if (x1 < 0 || x1 >= COLS || y1 < 0 || y1 >= ROWS || x2 < 0 || x2 >= COLS || y2 < 0 || y2 >= ROWS) {
    return false;
  }
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]]; // Simulate swap
  const can = getMatches(x1, y1).length >= 3 || getMatches(x2, y2).length >= 3;
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]]; // Swap back
  return can;
}

function startGame() {
  canvas.removeEventListener("mousedown", gameOverClickListener);
  gameState = "game";
  animating = false;
  initBoard();
  playGameMusic();
}

canvas.addEventListener("mousedown", e => {
  if (gameState === "gameover") {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (gameState === "menu") {
    for (const button of buttons) {
      if (mouseX >= button.x - button.width / 2 && mouseX <= button.x + button.width / 2 &&
          mouseY >= button.y - button.height / 2 && mouseY <= button.y + button.height / 2) {
        playSound("button");
        createParticles(mouseX, mouseY, "#fff", 10);
        button.action();
        return;
      }
    }
  } else if (gameState === "settings") {
    for (const button of settingsButtons) {
      if (mouseX >= button.x - button.width / 2 && mouseX <= button.x + button.width / 2 &&
          mouseY >= button.y - button.height / 2 && mouseY <= button.y + button.height / 2) {
        playSound("button");
        createParticles(mouseX, mouseY, "#fff", 10);
        button.action();
        return;
      }
    }
  } else if (gameState === "help") {
    const backButton = { x: canvas.width / 2, y: canvas.height - 60, width: 200, height: 50 };
    if (mouseX >= backButton.x - backButton.width / 2 && mouseX <= backButton.x + backButton.width / 2 &&
        mouseY >= backButton.y - backButton.height / 2 && mouseY <= backButton.y + backButton.height / 2) {
      playSound("button");
      createParticles(mouseX, mouseY, "#fff", 10);
      gameState = "menu";
      return;
    }
  } else if (gameState === "paused") {
    gameState = "game";
    return;
  } else if (gameState === "game") {
    const menuButton = { x: 50, y: HEADER_HEIGHT / 2, width: 80, height: 30 };
    if (mouseX >= menuButton.x - menuButton.width / 2 && mouseX <= menuButton.x + menuButton.width / 2 &&
        mouseY >= menuButton.y - menuButton.height / 2 && mouseY <= menuButton.y + menuButton.height / 2) {
      playSound("button");
      createParticles(mouseX, mouseY, "#fff", 10);
      gameState = "menu";
      pauseAllMusic();
      playGameMusic();
      return;
    }
    if (animating || mouseY < HEADER_HEIGHT) {
      return;
    }
    const x = Math.floor(mouseX / SIZE);
    const y = Math.floor((mouseY - HEADER_HEIGHT) / SIZE);
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
      return;
    }
    if (!selected) {
      selected = { x, y };
      playSound("select");
    } else {
      if (Math.abs(selected.x - x) + Math.abs(selected.y - y) === 1) { // Adjacent
        if (canSwapAndMatch(selected.x, selected.y, x, y)) {
          clearHintIfUsed(selected.x, selected.y, x, y);
          playSound("swap");
          animateSwap(selected.x, selected.y, x, y, () => {
            swapJewels(selected.x, selected.y, x, y);
          });
        } else { // Invalid swap (no match) - animate back
          animateSwap(selected.x, selected.y, x, y, () => {
            selected = null;
            animating = false;
          }, true); // true for reverse
        }
      } else { // Clicked non-adjacent or same jewel
        selected = { x, y }; // Select new jewel
        playSound("select");
      }
    }
  }
});

canvas.addEventListener("mousemove", e => {
  if (gameState === "gameover") {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (gameState === "game" && !animating) {
    if (mouseY >= HEADER_HEIGHT) {
      const x = Math.floor(mouseX / SIZE);
      const y = Math.floor((mouseY - HEADER_HEIGHT) / SIZE);
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) {
        hover = { x, y };
      } else {
        hover = null; // Outside board
      }
    } else {
      hover = { x: mouseX, y: mouseY }; // For header buttons
    }
  } else { // For menu, settings, help
    hover = { x: mouseX, y: mouseY };
  }
});

canvas.addEventListener("mouseleave", () => {
  if (gameState === "gameover") {
    return;
  }
  hover = null;
});

document.addEventListener("keydown", e => {
  if (gameState === "gameover") {
    return;
  }
  if (e.key === "Escape") {
    if (gameState === "game") {
      gameState = "paused";
    } else if (gameState === "paused") {
      gameState = "game";
    }
  }
});

function swapJewels(x1, y1, x2, y2) {
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  if (!removeMatches()) {
    [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]]; // Swap back if no matches
    selected = null;
    animating = false;
  } else {
    hintCell = null;
    hintPair = null;
    sounds.hint.pause();
    sounds.hint.currentTime = 0;
    lastMoveTime = Date.now();
    scheduleHintTimer();
    if (gameMode === "poisoned") {
      incrementPoisonedMoves();
    }
    selected = null;
    // animating will be set to false by removeMatches/animatePop completion
  }
}

function incrementPoisonedMoves() {
  movesCounter++;
  if (movesCounter % poisonedMovesBeforeSpawn === 0) {
    addPoisonedJewel();
  }
  for (const pos of poisonedJewels) {
    const poisonKey = `${pos.x},${pos.y}`;
    if (poisonedMovesLeft[poisonKey]) {
      poisonedMovesLeft[poisonKey]--;
    }
  }
  updatePoisonedJewels();
}

function removeMatches() {
  let removedAny = false;
  let marks = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === null) {
        continue;
      }
      let matches = getMatches(x, y);
      if (matches.length >= 3) {
        matches.forEach(({ x: mx, y: my }) => marks[my][mx] = true);
        removedAny = true;
      }
    }
  }

  if (removedAny) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (marks[r][c]) {
          const neighbors = [{x:c,y:r-1},{x:c,y:r+1},{x:c-1,y:r},{x:c+1,y:r}];
          for (const n of neighbors) {
            if (n.x >= 0 && n.x < COLS && n.y >= 0 && n.y < ROWS &&
                isPoisonedJewel(n.x, n.y) && !marks[n.y][n.x]) {
              marks[n.y][n.x] = true;
            }
          }
        }
      }
    }

    playSound("match");
    popping = [];
    let actualPoisonEffectCreated = false;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (marks[y][x]) {
          let wasP = isPoisonedJewel(x,y);
          if (wasP) {
            const pIndex = poisonedJewels.findIndex(p => p.x === x && p.y === y);
            if (pIndex > -1) {
              poisonedJewels.splice(pIndex, 1);
            }
            delete poisonedMovesLeft[`${x},${y}`];
            if(!actualPoisonEffectCreated){
              createParticles(canvas.width / 2, canvas.height / 2, "rgba(44,62,80,0.9)", 30);
              actualPoisonEffectCreated = true;
            }
          }
          popping.push({ x, y, progress: 0, type: board[y][x], wasPoison: wasP });
          
          let particleColor;
          if (wasP && poisonImage) {
            particleColor = "rgba(44,62,80,0.7)";
          } else if (jewelImages[board[y][x]]) {
            particleColor = "rgba(200,200,200,0.7)";
          } else {
            particleColor = "rgba(128,128,128,0.7)";
          }
          createParticles(x * SIZE + SIZE / 2, (y * SIZE + SIZE / 2) + HEADER_HEIGHT, particleColor, 10);
        }
      }
    }

    animatePop(() => {
      let pointsFromThisRound = 0;
      popping.forEach(p => {
        pointsFromThisRound += p.wasPoison ? 20 : 10;
      });
      score += pointsFromThisRound;
      if (scoreDiv) {
        scoreDiv.textContent = "Wynik: " + score;
      }

      for (let x = 0; x < COLS; x++) {
        let emptySlots = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
          if (marks[y][x]) {
            emptySlots++;
          } else if (emptySlots > 0) {
            board[y + emptySlots][x] = board[y][x];
          }
        }
        for (let y = 0; y < emptySlots; y++) {
          board[y][x] = randJewel();
        }
      }
      popping = [];
      animating = false;
      setTimeout(() => {
        if (!removeMatches()) {
          animating = false;
        }
      }, 150);
    });
    return true;
  }
  animating = false;
  return false;
}

function animatePop(onComplete) {
  animating = true;
  let start = null;
  function popFrame(ts) {
    if (!start) {
      start = ts;
    }
    let t = (ts - start) / 350;
    popping.forEach(p => p.progress = Math.min(1, t));
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
  const jewelType1 = board[y1][x1];
  const jewelType2 = board[y2][x2];
  const isPoison1 = isPoisonedJewel(x1,y1);
  const isPoison2 = isPoisonedJewel(x2,y2);

  function swapFrame(ts) {
    if (!start) {
      start = ts;
    }
    let t = Math.min(1, (ts - start) / 200); 
    swapAnim = { x1, y1, x2, y2, progress: reverse ? 1 - t : t }; 
    
    const currentProgress = reverse ? 1 - t : t;
    const sx = x1 * SIZE;
    const sy = y1 * SIZE + HEADER_HEIGHT;
    const dx = x2 * SIZE;
    const dy = y2 * SIZE + HEADER_HEIGHT;
    const jewelDrawSizeSwap = SIZE * JEWEL_VISUAL_SCALE;

    // Rysuj pierwszy klejnot
    ctx.save();
    ctx.translate(sx + (dx - sx) * currentProgress + SIZE / 2, sy + (dy - sy) * currentProgress + SIZE / 2);
    let scale1 = 1;
    if (selected && selected.x === x1 && selected.y === y1) {
      scale1 = 1.1;
    }
    ctx.scale(scale1, scale1);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    if (selected && selected.x === x1 && selected.y === y1) {
      ctx.shadowColor = "#FFFFFF";
      ctx.shadowBlur = 3;
    }
    let img1 = isPoison1 ? poisonImage : (jewelType1 >=0 && jewelType1 < jewelImages.length ? jewelImages[jewelType1] : null);
    if (img1 && img1.complete) {
      ctx.drawImage(img1, -jewelDrawSizeSwap / 2, -jewelDrawSizeSwap / 2, jewelDrawSizeSwap, jewelDrawSizeSwap);
    } else {
      ctx.fillStyle = 'grey';
      ctx.fillRect(-jewelDrawSizeSwap/2, -jewelDrawSizeSwap/2, jewelDrawSizeSwap, jewelDrawSizeSwap);
    }
    ctx.restore();

    // Rysuj drugi klejnot
    ctx.save();
    ctx.translate(dx + (sx - dx) * currentProgress + SIZE / 2, dy + (sy - dy) * currentProgress + SIZE / 2);
    let scale2 = 1;
    if (selected && selected.x === x2 && selected.y === y2) {
      scale2 = 1.1;
    }
    ctx.scale(scale2, scale2);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    if (selected && selected.x === x2 && selected.y === y2) {
      ctx.shadowColor = "#FFFFFF";
      ctx.shadowBlur = 3;
    }
    let img2 = isPoison2 ? poisonImage : (jewelType2 >=0 && jewelType2 < jewelImages.length ? jewelImages[jewelType2] : null);
    if (img2 && img2.complete) {
      ctx.drawImage(img2, -jewelDrawSizeSwap / 2, -jewelDrawSizeSwap / 2, jewelDrawSizeSwap, jewelDrawSizeSwap);
    } else {
      ctx.fillStyle = 'grey';
      ctx.fillRect(-jewelDrawSizeSwap/2, -jewelDrawSizeSwap/2, jewelDrawSizeSwap, jewelDrawSizeSwap);
    }
    ctx.restore();

    if (t < 1) {
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

loadJewelImages(() => {
  console.log("All jewel images loaded.");
  // allImagesReady jest już ustawiane wewnątrz loadJewelImages
  animate(); 
  let musicStarted = false;
  function tryStartMusic() {
    if (!musicStarted && musicEnabled && (gameState === "game" || gameState === "menu")) {
      playGameMusic();
      musicStarted = true;
    }
  }
  document.addEventListener("mousedown", tryStartMusic, { once: true });
});