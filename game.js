// Game with menu and sound effects
// Current User: Bagjjeta
// Last modification: 2025-05-17 19:04:02 UTC (Formatted for readability)

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreDiv = document.getElementById("score");
const recordScoreDiv = document.getElementById("recordScoreDiv");

// Game constants
const ROWS = 8;
const COLS = 8;
const SIZE = 75;
const JEWEL_TYPES = 5;
const HEADER_HEIGHT = 40;
const JEWEL_VISUAL_SCALE = 0.85;
const POISON_JEWEL_TYPE = -1;

// Image paths and objects
const jewelImagePaths = [
  'icon/blue.png', 'icon/yellow.png', 'icon/green.png',
  'icon/red.png', 'icon/purple.png'
];
const poisonImagePath = 'icon/poison.png';

let jewelImages = [];
let poisonImage = new Image();
let allImagesReady = false;

// Game state
let board = [];
let selected = null;
let animating = false;
let score = 0;
let recordScore = 0;
let hover = null;
let popping = [];
let swapAnim = null;
let hintCell = null;
let hintPair = null;
let hintTimer = null;
let lastMoveTime = Date.now();
let gameState = "modeSelection";
let soundEnabled = true;
let musicEnabled = true;
let particleEffects = [];
let gameMode = "classic"; // Domyślny tryb gry
let movesCounter = 0;
let poisonedJewels = []; // Lista koordynatów {x, y} aktywnych trucizn
let poisonedMovesLeft = {}; // Obiekt przechowujący pozostałe ruchy dla każdej trucizny { "x,y": moves }
let poisonedMovesBeforeSpawn = 3;
let poisonedMovesBeforeSpread = 5; // Przywrócono wartość 8

// Sound effects
const sounds = {
  select: new Audio('./sounds/select.mp3'),
  swap: new Audio('./sounds/swap.mp3'),
  match: new Audio('./sounds/match.mp3'),
  hint: new Audio('./sounds/hint.mp3'),
  button: new Audio('./sounds/button_sound.mp3'),
  music: new Audio('./sounds/music.mp3'),
  poisonedMusic: new Audio('./sounds/poisoned_music.mp3'),
  poison: new Audio('./sounds/poison.mp3'),
  gameover: new Audio('./sounds/gameover.mp3')
};

Object.values(sounds).forEach(sound => {
  sound.load();
  sound.volume = 0.5;
});
sounds.music.loop = true;
sounds.music.volume = 0.3;
sounds.poisonedMusic.loop = true;
sounds.poisonedMusic.volume = 0.3;
sounds.gameover.volume = 0.6;

function loadJewelImages(callback) {
  let loadedCount = 0;
  const totalImages = jewelImagePaths.length + 1; // +1 dla poisonImage

  function imageLoaded() {
    loadedCount++;
    if (loadedCount === totalImages) {
      allImagesReady = true;
      if (callback) {
        callback();
      }
    }
  }

  jewelImagePaths.forEach((path, i) => {
    const img = new Image();
    img.src = path;
    jewelImages[i] = img;
    img.onload = imageLoaded;
    img.onerror = () => {
      console.error("Failed to load image:", path);
      imageLoaded(); // Zliczaj nawet jeśli błąd, aby callback się wykonał
    };
  });

  poisonImage.src = poisonImagePath;
  poisonImage.onload = imageLoaded;
  poisonImage.onerror = () => {
    console.error("Failed to load image:", poisonImagePath);
    imageLoaded();
  };
}

function playSound(soundName) {
  if (soundEnabled && sounds[soundName]) {
    if (soundName === "hint" && sounds.hint.currentTime > 0 && !sounds.hint.paused) {
        sounds.hint.pause();
        sounds.hint.currentTime = 0;
    }
    sounds[soundName].currentTime = 0;
    sounds[soundName].play().catch(e => {
      console.log("Audio play error for " + soundName + ":", e);
    });
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

const modeSelectionButtons = [
  {
    text: "TRYB KLASYCZNY", x: canvas.width / 2, y: 250, width: 300, height: 60,
    action: () => {
      gameMode = "classic";
      gameState = "menu";
      settingsMenuButtons[2].text = `GAME MODE: ${gameMode.toUpperCase()}`; // Aktualizuj tekst w ustawieniach
      playGameMusic();
    }
  },
  {
    text: "ZATRUTE KLEJNOTY", x: canvas.width / 2, y: 340, width: 300, height: 60,
    action: () => {
      gameMode = "poisoned";
      gameState = "menu";
      settingsMenuButtons[2].text = `GAME MODE: ${gameMode.toUpperCase()}`; // Aktualizuj tekst w ustawieniach
      playGameMusic();
    }
  }
];

const mainMenuButtons = [
  {
    text: "PLAY", x: canvas.width / 2, y: 200, width: 200, height: 50,
    action: () => startGame()
  },
  {
    text: "SETTINGS", x: canvas.width / 2, y: 270, width: 200, height: 50,
    action: () => { gameState = "settings"; }
  },
  {
    text: "HELP", x: canvas.width / 2, y: 340, width: 200, height: 50,
    action: () => { gameState = "help"; }
  }
];

const settingsMenuButtons = [
  {
    text: "SOUND: ON", x: canvas.width / 2, y: 170, width: 240, height: 50,
    action: () => {
      soundEnabled = !soundEnabled;
      settingsMenuButtons[0].text = soundEnabled ? "SOUND: ON" : "SOUND: OFF";
    }
  },
  {
    text: "MUSIC: ON", x: canvas.width / 2, y: 240, width: 240, height: 50,
    action: () => {
      toggleMusic();
      settingsMenuButtons[1].text = musicEnabled ? "MUSIC: ON" : "MUSIC: OFF";
    }
  },
  {
    text: "GAME MODE: CLASSIC", x: canvas.width / 2, y: 310, width: 280, height: 50, // Tekst aktualizowany dynamicznie
    action: () => {
      gameMode = gameMode === "classic" ? "poisoned" : "classic";
      settingsMenuButtons[2].text = `GAME MODE: ${gameMode.toUpperCase()}`;
    }
  },
  {
    text: "BACK", x: canvas.width / 2, y: 380, width: 200, height: 50,
    action: () => { gameState = "menu"; }
  }
];

function scheduleHintTimer() {
  if (hintTimer) {
    clearTimeout(hintTimer);
  }
  if (gameState === "game") {
    hintTimer = setTimeout(checkAndShowHint, 20000); // 20 sekund
  }
}

function checkAndShowHint() {
  const now = Date.now();
  if (now - lastMoveTime >= 20000 && !hintCell && gameState === "game" && !animating) {
    showHint();
  } else if (gameState === "game") { // Kontynuuj sprawdzanie tylko w stanie gry
    hintTimer = setTimeout(checkAndShowHint, 1000); // Sprawdzaj co sekundę
  }
}

function showHint() {
  if (animating || gameState !== "game") {
    if (gameState === "game") { // Jeśli gra, ale animacja, spróbuj później
        hintTimer = setTimeout(showHint, 1000);
    }
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
    // Jeśli nie ma podpowiedzi, to znaczy, że nie ma ruchów
    if (gameState === "game" && !checkForPossibleMoves()) {
        if (gameState !== "gameover") { // Unikaj wielokrotnego wywoływania gameover
            playSound("gameover");
            gameOver("Brak ruchów!");
        }
    }
  }
}

function findFirstPossibleMove() {
  // Sprawdź poziome zamiany
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (canSwapAndMatch(x, y, x + 1, y)) {
        return { x, y, x2: x + 1, y2: y };
      }
    }
  }
  // Sprawdź pionowe zamiany
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS - 1; y++) {
      if (canSwapAndMatch(x, y, x, y + 1)) {
        return { x, y, x2: x, y2: y + 1 };
      }
    }
  }
  return null; // Brak możliwych ruchów
}

function checkForPossibleMoves() {
  // Sprawdź poziome zamiany
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS - 1; x++) {
      if (canSwapAndMatch(x, y, x + 1, y)) {
        return true;
      }
    }
  }
  // Sprawdź pionowe zamiany
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS - 1; y++) {
      if (canSwapAndMatch(x, y, x, y + 1)) {
        return true;
      }
    }
  }
  return false; // Brak możliwych ruchów
}

function clearHintIfUsed(x1, y1, x2, y2) {
  if (hintCell && hintPair &&
    (((hintCell.x === x1 && hintCell.y === y1) && (hintPair.x === x2 && hintPair.y === y2)) ||
     ((hintCell.x === x2 && hintCell.y === y2) && (hintPair.x === x1 && hintPair.y === y1)))) {
    hintCell = null;
    hintPair = null;
    if (sounds.hint.currentTime > 0 && !sounds.hint.paused) {
      sounds.hint.pause();
      sounds.hint.currentTime = 0;
    }
    lastMoveTime = Date.now();
    scheduleHintTimer();
  }
}

function updateRecordScoreDisplay() {
  if (recordScoreDiv) {
    recordScoreDiv.textContent = "Rekord: " + recordScore;
  }
}

function initBoard(attempt = 1) {
  if (gameState === "gameover" && attempt > 1) {
    return;
  }
  if (attempt > 5) {
    console.error("Nie udało się stworzyć grywalnej planszy po 5 próbach.");
    if (gameState !== "gameover") {
      playSound("gameover");
      gameOver("Błąd planszy!");
    }
    return;
  }

  board = [];
  for (let y = 0; y < ROWS; y++) {
    let row = [];
    for (let x = 0; x < COLS; x++) {
      row.push(randJewel());
    }
    board.push(row);
  }
  removeInitialMatches();

  if (gameState !== "gameover" && !checkForPossibleMoves()) {
    console.log(`Plansza startowa bez ruchów (próba ${attempt}). Przetasowuję.`);
    initBoard(attempt + 1); // Spróbuj ponownie
    return; // Zakończ bieżące wywołanie
  }

  if (gameState === "gameover") { // Jeśli checkForPossibleMoves zakończyło grę
      return;
  }

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
  updateRecordScoreDisplay();

  movesCounter = 0;
  poisonedJewels = [];
  poisonedMovesLeft = {};
  animating = false; // Upewnij się, że gra nie jest zablokowana
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
        if (board[y][x] === null || board[y][x] === POISON_JEWEL_TYPE) {
          continue;
        }
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

  if (gameState === "gameover") {
    drawParticles(); // Tylko cząsteczki, resztę rysuje gameOver()
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradientBg = ctx.createLinearGradient(0, 0, 0, canvas.height);

  if (gameState === "modeSelection" || gameState === "menu" ||
      (gameState === "game" && gameMode === "classic") ||
      gameState === "settings" || gameState === "help") {
    gradientBg.addColorStop(0, "#1a1a2e");
    gradientBg.addColorStop(1, "#16213e");
  } else if (gameState === "game" && gameMode === "poisoned") {
    gradientBg.addColorStop(0, "#1e272e");
    gradientBg.addColorStop(1, "#2c3e50");
  } else { 
    // Domyślne tło dla nieobsługiwanych stanów (nie powinno być potrzebne)
    gradientBg.addColorStop(0, "#000000");
    gradientBg.addColorStop(1, "#000000");
  }
  ctx.fillStyle = gradientBg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (gameState === "modeSelection") {
    drawModeSelectionScreen(now);
  } else if (gameState === "menu") {
    drawMenuScreen(now);
  } else if (gameState === "settings") {
    drawSettingsScreen(now);
  } else if (gameState === "help") {
    drawHelpScreen();
  } else if (gameState === "game" || gameState === "paused") {
    drawGameScreen(now);
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

function drawModeSelectionScreen(now) {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px Arial";
  ctx.textAlign = "center";
  ctx.fillText("WYBIERZ TRYB GRY", canvas.width / 2, 150);

  for (const button of modeSelectionButtons) {
    const isHovered = hover &&
                      hover.x >= button.x - button.width / 2 && hover.x <= button.x + button.width / 2 &&
                      hover.y >= button.y - button.height / 2 && hover.y <= button.y + button.height / 2;
    drawButton(button, isHovered);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "16px Arial";
  ctx.fillText("Wybierz tryb, w którym chcesz zagrać.", canvas.width / 2, canvas.height - 80);
}

function drawMenuScreen(now) {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("JEWELS CRASH", canvas.width / 2, 120);

  const gemSize = 35;
  const gemX = canvas.width / 2 + 140;
  const gemY = 70;
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
      ctx.restore();

      ctx.save();
      ctx.translate(gemX2, gemY);
      ctx.scale(pulse, pulse);
      ctx.drawImage(imgToDraw, -gemSize / 2, -gemSize / 2, gemSize, gemSize);
      ctx.restore();
    }
  }

  for (const button of mainMenuButtons) {
    const isHovered = hover &&
                      hover.x >= button.x - button.width / 2 && hover.x <= button.x + button.width / 2 &&
                      hover.y >= button.y - button.height / 2 && hover.y <= button.y + button.height / 2;
    drawButton(button, isHovered);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  ctx.font = "15px Arial";
  ctx.fillText("© 2025 Bagjjeta", canvas.width / 2, canvas.height - 20);
}

function drawSettingsScreen(now) {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Arial";
  ctx.textAlign = "center";
  ctx.fillText("SETTINGS", canvas.width / 2, 120);

  for (const button of settingsMenuButtons) {
    const isHovered = hover &&
                      hover.x >= button.x - button.width / 2 && hover.x <= button.x + button.width / 2 &&
                      hover.y >= button.y - button.height / 2 && hover.y <= button.y + button.height / 2;
    drawButton(button, isHovered);
  }
}

function drawHelpScreen() {
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
  yPos += 20; // Dodatkowy odstęp

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
    text: "BACK", x: canvas.width / 2, y: canvas.height - 60, width: 200, height: 50,
    action: () => { gameState = "menu"; }
  };
  const isBackHovered = hover &&
                        hover.x >= backButtonConfig.x - backButtonConfig.width / 2 && hover.x <= backButtonConfig.x + backButtonConfig.width / 2 &&
                        hover.y >= backButtonConfig.y - backButtonConfig.height / 2 && hover.y <= backButtonConfig.y + backButtonConfig.height / 2;
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
    ctx.stroke(); // Ponowne obrysowanie z cieniem
    ctx.shadowBlur = 0; // Reset cienia
  }
}

function drawGameScreen(now) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, 0, canvas.width, HEADER_HEIGHT);

  const menuButtonConfig = {
    text: "MENU", x: 50, y: HEADER_HEIGHT / 2, width: 80, height: 30,
    action: () => {
      gameState = "menu";
      pauseAllMusic();
      playGameMusic(); // Odtwórz muzykę menu
    }
  };
  const isMenuButtonHovered = hover &&
                              hover.x >= menuButtonConfig.x - menuButtonConfig.width / 2 && hover.x <= menuButtonConfig.x + menuButtonConfig.width / 2 &&
                              hover.y >= menuButtonConfig.y - menuButtonConfig.height / 2 && hover.y <= menuButtonConfig.y + menuButtonConfig.height / 2;
  drawButton(menuButtonConfig, isMenuButtonHovered);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "center";
  if (scoreDiv) { // scoreDiv jest elementem HTML, nie rysujemy go na canvas
      // ctx.fillText("Score: " + score, canvas.width / 2, HEADER_HEIGHT / 2 + 5); // To jest na canvas
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
    if (p.type === POISON_JEWEL_TYPE && poisonImage && poisonImage.complete) {
        imgToPop = poisonImage;
    } else if (p.type >= 0 && p.type < jewelImages.length && jewelImages[p.type] && jewelImages[p.type].complete) {
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
      
      let jewelTypeOnBoard = board[y][x];
      if (jewelTypeOnBoard === null) { // Puste pole
        continue;
      }

      let currentScale = 1;
      const poisonKey = `${x},${y}`;

      if (selected && selected.x === x && selected.y === y) {
        currentScale = 1.2 + 0.04 * Math.sin(now / 120);
      } else if (hover && hover.x === x && hover.y === y && !animating) {
        currentScale = 1.1;
      } else if (hintCell && hintPair && ((hintCell.x === x && hintCell.y === y) || (hintPair.x === x && hintPair.y === y)) && !selected && !animating) {
        currentScale = 1.15 + 0.03 * Math.sin(now / 80);
      } else if (gameMode === "poisoned" && jewelTypeOnBoard === POISON_JEWEL_TYPE && poisonedMovesLeft[poisonKey] !== undefined && poisonedMovesLeft[poisonKey] <= 2) {
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
      } else if (gameMode === "poisoned" && jewelTypeOnBoard === POISON_JEWEL_TYPE && poisonedMovesLeft[poisonKey] !== undefined && poisonedMovesLeft[poisonKey] <= 2) {
        ctx.shadowColor = "#FF0000";
        ctx.shadowBlur = 3;
      }
      
      let currentJewelImage = null;
      if (jewelTypeOnBoard === POISON_JEWEL_TYPE) {
        currentJewelImage = poisonImage;
      } else if (jewelTypeOnBoard >= 0 && jewelTypeOnBoard < jewelImages.length) {
        currentJewelImage = jewelImages[jewelTypeOnBoard];
      }

      const jewelDrawSize = SIZE * JEWEL_VISUAL_SCALE;
      if (currentJewelImage && currentJewelImage.complete) {
        ctx.drawImage(currentJewelImage, -jewelDrawSize / 2, -jewelDrawSize / 2, jewelDrawSize, jewelDrawSize);
      } else {
        ctx.fillStyle = 'grey';
        ctx.fillRect(-jewelDrawSize / 2, -jewelDrawSize / 2, jewelDrawSize, jewelDrawSize);
      }
      
      // Rysuj licznik na zatrutych klejnotach
      if (gameMode === "poisoned" && jewelTypeOnBoard === POISON_JEWEL_TYPE && poisonedMovesLeft[poisonKey] !== undefined) {
        ctx.shadowBlur = 0; // Reset cienia przed rysowaniem tekstu
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = 'black'; // Obwódka tekstu
        ctx.lineWidth = 2; 
        ctx.strokeText(poisonedMovesLeft[poisonKey], 0, 0);
        ctx.fillText(poisonedMovesLeft[poisonKey], 0, 0);
      }
      ctx.restore(); 
    }
  }
}

function isPoisonedJewel(x, y) { // Sprawdza, czy trucizna jest na liście aktywnych
  return poisonedJewels.some(pos => pos.x === x && pos.y === y);
}

function addPoisonedJewel() {
  if (gameMode !== "poisoned" || gameState === "gameover") {
    return;
  }
  let emptyPositions = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== POISON_JEWEL_TYPE) { // Stawiaj tylko na niezatrutych polach
         emptyPositions.push({x, y});
      }
    }
  }
  if (emptyPositions.length > 0) {
    const pos = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    board[pos.y][pos.x] = POISON_JEWEL_TYPE; // Ustaw typ na planszy
    poisonedJewels.push({x: pos.x, y: pos.y}); // Dodaj do listy aktywnych trucizn
    poisonedMovesLeft[`${pos.x},${pos.y}`] = poisonedMovesBeforeSpread;
    playSound("poison");
    createParticles(pos.x * SIZE + SIZE / 2, pos.y * SIZE + SIZE / 2 + HEADER_HEIGHT, "rgba(44, 62, 80, 0.8)", 30);
  }
}

function updatePoisonedJewels() {
  if (gameMode !== "poisoned" || gameState === "gameover") {
    return;
  }
  let spreadOccurred = false;
  let newPoisonedPositions = []; // Miejsca, gdzie trucizna się rozprzestrzeni w tej turze

  for (let i = poisonedJewels.length - 1; i >= 0; i--) {
    const pos = poisonedJewels[i];
    const poisonKey = `${pos.x},${pos.y}`;

    // Jeśli pole na planszy nie jest już trucizną (np. zostało usunięte przez dopasowanie)
    if (board[pos.y][pos.x] !== POISON_JEWEL_TYPE) {
        poisonedJewels.splice(i, 1); // Usuń z listy aktywnych
        delete poisonedMovesLeft[poisonKey];
        continue;
    }

    if (poisonedMovesLeft[poisonKey] !== undefined && poisonedMovesLeft[poisonKey] <= 0) {
      spreadOccurred = true;
      const directions = [{dx: 1, dy: 0}, {dx: -1, dy: 0}, {dx: 0, dy: 1}, {dx: 0, dy: -1}];
      for (const dir of directions) {
        const newX = pos.x + dir.dx;
        const newY = pos.y + dir.dy;
        if (newX >= 0 && newX < COLS && newY >= 0 && newY < ROWS &&
            board[newY][newX] !== POISON_JEWEL_TYPE && // Rozprzestrzeniaj tylko na niezatrute
            !newPoisonedPositions.some(p => p.x === newX && p.y === newY)) { // I jeszcze nie zaplanowane do zatrucia
          newPoisonedPositions.push({x: newX, y: newY});
        }
      }
      poisonedMovesLeft[poisonKey] = poisonedMovesBeforeSpread; // Resetuj licznik "starej" trucizny
    }
  }

  for (const newPos of newPoisonedPositions) {
    // Upewnij się, że pole wciąż nie jest zatrute (na wypadek wielokrotnego rozprzestrzeniania na to samo pole w jednej turze)
    if (board[newPos.y][newPos.x] !== POISON_JEWEL_TYPE) {
      board[newPos.y][newPos.x] = POISON_JEWEL_TYPE;
      poisonedJewels.push({x: newPos.x, y: newPos.y});
      poisonedMovesLeft[`${newPos.x},${newPos.y}`] = poisonedMovesBeforeSpread;
      createParticles(newPos.x * SIZE + SIZE / 2, newPos.y * SIZE + SIZE / 2 + HEADER_HEIGHT, "rgba(44, 62, 80, 0.8)", 15);
    }
  }

  if (spreadOccurred) {
    playSound("poison");
  }
  
  // Sprawdź, czy cała plansza jest zatruta
  let nonPoisonCount = 0;
  for(let r=0; r<ROWS; r++) {
    for(let c=0; c<COLS; c++) {
        // Policz pola, które nie są zatrute i nie są puste (null)
        if(board[r][c] !== POISON_JEWEL_TYPE && board[r][c] !== null) {
            nonPoisonCount++;
        }
    }
  }
  if (nonPoisonCount === 0 && gameState !== "gameover") {
    playSound("gameover");
    gameOver("Zatrucie planszy!");
  }
}


function gameOver(reason = "Koniec Gry") {
  if (gameState === "gameover") {
    return; // Zapobiegaj wielokrotnemu wywołaniu
  }
  animating = true; // Zatrzymaj inne animacje, jeśli były aktywne
  gameState = "gameover";
  pauseAllMusic();
  // Dźwięk "gameover" jest odtwarzany przed wywołaniem tej funkcji

  setTimeout(() => {
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 60);

    ctx.font = "bold 28px Arial";
    ctx.fillText(reason, canvas.width / 2, canvas.height / 2 - 10);

    ctx.font = "24px Arial";
    ctx.fillText(`Wynik: ${score}`, canvas.width / 2, canvas.height / 2 + 40);
    
    const retryButton = {
      text: "RETRY", x: canvas.width / 2, y: canvas.height / 2 + 100, width: 200, height: 50,
      action: () => {
        startGame(); // Bezpośrednio uruchom nową grę
      }
    };
    drawButton(retryButton, false); // Narysuj przycisk
    canvas.addEventListener("mousedown", gameOverClickListener); // Dodaj listener dla kliknięcia
  }, 300); // Krótsze opóźnienie dla szybszego pojawienia się ekranu
}

function gameOverClickListener(e) {
  if (gameState !== "gameover") { // Upewnij się, że działamy tylko na ekranie gameover
    return;
  }
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const retryButtonConfig = { // Użyj tej samej konfiguracji co w gameOver dla spójności
      x: canvas.width / 2, 
      y: canvas.height / 2 + 100, 
      width: 200, 
      height: 50
  };
  
  const buttonLeft = retryButtonConfig.x - retryButtonConfig.width / 2;
  const buttonRight = retryButtonConfig.x + retryButtonConfig.width / 2;
  const buttonTop = retryButtonConfig.y - retryButtonConfig.height / 2;
  const buttonBottom = retryButtonConfig.y + retryButtonConfig.height / 2;

  if (mouseX >= buttonLeft && mouseX <= buttonRight &&
      mouseY >= buttonTop && mouseY <= buttonBottom) {
    playSound("button");
    canvas.removeEventListener("mousedown", gameOverClickListener); // Usuń ten specyficzny listener
    startGame(); // Bezpośrednio uruchom nową grę
  }
}

function getMatches(x, y) {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS || board[y][x] === null || board[y][x] === POISON_JEWEL_TYPE) {
    return [];
  }
  const jewel = board[y][x]; // Teraz 'jewel' na pewno jest typem kolorowego klejnotu
  
  let horiz = [{ x, y }];
  let vert = [{ x, y }];

  // Sprawdź w lewo
  for (let dx = x - 1; dx >= 0 && board[y][dx] === jewel; dx--) {
    horiz.push({ x: dx, y });
  }
  // Sprawdź w prawo
  for (let dx = x + 1; dx < COLS && board[y][dx] === jewel; dx++) {
    horiz.push({ x: dx, y });
  }
  // Sprawdź w górę
  for (let dy = y - 1; dy >= 0 && board[dy] && board[dy][x] === jewel; dy--) {
    vert.push({ x, y: dy });
  }
  // Sprawdź w dół
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
  // Usuń duplikaty (jeśli klejnot jest częścią zarówno poziomego, jak i pionowego dopasowania)
  return result.filter((v, i, a) => a.findIndex(t => t.x === v.x && t.y === v.y) === i);
}

function canSwapAndMatch(x1, y1, x2, y2) {
  // Sprawdzenie granic i czy pola nie są puste
  if (x1 < 0 || x1 >= COLS || y1 < 0 || y1 >= ROWS ||
      x2 < 0 || x2 >= COLS || y2 < 0 || y2 >= ROWS ||
      board[y1][x1] === null || board[y2][x2] === null) {
    return false;
  }
  // Nie można zamieniać zatrutych klejnotów
  if (board[y1][x1] === POISON_JEWEL_TYPE || board[y2][x2] === POISON_JEWEL_TYPE) {
    return false;
  }

  // Symulacja zamiany
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  const can = getMatches(x1, y1).length >= 3 || getMatches(x2, y2).length >= 3;
  // Cofnięcie symulacji
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
  return can;
}

function startGame() {
  canvas.removeEventListener("mousedown", gameOverClickListener); // Usuń stary listener, jeśli istnieje
  gameState = "game";
  animating = false;
  initBoard(); // initBoard resetuje planszę i stany związane z grą
  playGameMusic(); // Odtwórz muzykę odpowiednią dla trybu gry
}

canvas.addEventListener("mousedown", e => {
  if (gameState === "gameover") { // Główny listener nie działa na ekranie gameover
    return;
  }
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  let buttonsToClick = [];
  if (gameState === "modeSelection") {
    buttonsToClick = modeSelectionButtons;
  } else if (gameState === "menu") {
    buttonsToClick = mainMenuButtons;
  } else if (gameState === "settings") {
    buttonsToClick = settingsMenuButtons;
  }
  
  if (buttonsToClick.length > 0) {
    for (const button of buttonsToClick) {
      if (mouseX >= button.x - button.width / 2 && mouseX <= button.x + button.width / 2 &&
          mouseY >= button.y - button.height / 2 && mouseY <= button.y + button.height / 2) {
        playSound("button");
        createParticles(mouseX, mouseY, "#fff", 10);
        button.action();
        return;
      }
    }
  } else if (gameState === "help") {
    const backButton = { x: canvas.width / 2, y: canvas.height - 60, width: 200, height: 50 }; // Definicja przycisku BACK dla help
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
    const menuButton = { x: 50, y: HEADER_HEIGHT / 2, width: 80, height: 30 }; // Przycisk MENU w grze
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

    if (x < 0 || x >= COLS || y < 0 || y >= ROWS || board[y][x] === POISON_JEWEL_TYPE) { // Nie można wybrać zatrutego
      return;
    }

    if (!selected) {
      selected = { x, y };
      playSound("select");
    } else {
      // Upewnij się, że drugie kliknięcie nie jest na zatrutym
      if (board[y][x] === POISON_JEWEL_TYPE || (board[selected.y] && board[selected.y][selected.x] === POISON_JEWEL_TYPE)) {
          selected = null; // Odznacz, jeśli próba interakcji z zatrutym
          return;
      }

      if (Math.abs(selected.x - x) + Math.abs(selected.y - y) === 1) { // Czy sąsiadują?
        if (canSwapAndMatch(selected.x, selected.y, x, y)) {
          clearHintIfUsed(selected.x, selected.y, x, y);
          playSound("swap");
          animateSwap(selected.x, selected.y, x, y, () => {
            swapJewels(selected.x, selected.y, x, y);
          });
        } else { // Nieprawidłowa zamiana (nie tworzy dopasowania)
          animateSwap(selected.x, selected.y, x, y, () => {
            selected = null;
            animating = false;
          }, true); // true dla animacji powrotnej
        }
      } else { // Kliknięto na inny, nie sąsiadujący klejnot
        selected = {x,y};
        playSound("select");
      }
    }
  }
});

canvas.addEventListener("mousemove", e => {
  if (gameState === "gameover") return;
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
        hover = null;
      }
    } else { // Hover nad przyciskiem MENU w grze
      hover = { x: mouseX, y: mouseY };
    }
  } else { // Hover dla ekranów menu, ustawień itp.
    hover = { x: mouseX, y: mouseY };
  }
});

canvas.addEventListener("mouseleave", () => {
  if (gameState === "gameover") return;
  hover = null;
});

document.addEventListener("keydown", e => {
  if (gameState === "gameover") return;
  if (e.key === "Escape") {
    if (gameState === "game") {
      gameState = "paused";
    } else if (gameState === "paused") {
      gameState = "game";
    } else if (gameState === "settings" || gameState === "help") {
      gameState = "menu";
    }
  }
});

function swapJewels(x1, y1, x2, y2) {
  [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]]; // Wykonaj zamianę

  if (!removeMatches()) { // removeMatches teraz obsługuje sprawdzanie braku ruchów na końcu
    // Jeśli nie było dopasowań, cofnij zamianę (nie powinno się zdarzyć, jeśli canSwapAndMatch działa)
    [board[y1][x1], board[y2][x2]] = [board[y2][x2], board[y1][x1]];
    selected = null;
    animating = false;
    // Sprawdź, czy po nieudanym ruchu nie ma ruchów (awaryjne)
    if (gameState !== "gameover" && !checkForPossibleMoves()) {
        if (gameState !== "gameover") { playSound("gameover"); gameOver("Brak ruchów!"); }
    }
  } else {
    // Dopasowania znalezione i przetworzone przez removeMatches
    hintCell = null;
    hintPair = null;
    if (sounds.hint.currentTime > 0 && !sounds.hint.paused) {
      sounds.hint.pause();
      sounds.hint.currentTime = 0;
    }
    // lastMoveTime i scheduleHintTimer są resetowane w removeMatches po zakończeniu reakcji
    if (gameMode === "poisoned") {
      incrementPoisonedMoves();
    }
    selected = null;
    // Stan 'animating' jest zarządzany przez removeMatches/animatePop
  }
}

function incrementPoisonedMoves() {
  if (gameState === "gameover") return;
  movesCounter++;
  if (movesCounter % poisonedMovesBeforeSpawn === 0) {
    addPoisonedJewel();
  }
  // Zmniejsz liczniki dla wszystkich aktywnych trucizn
  for (const pos of poisonedJewels) { // Iteruj po kopii, jeśli modyfikujesz listę w updatePoisonedJewels
    const poisonKey = `${pos.x},${pos.y}`;
    if (poisonedMovesLeft[poisonKey] !== undefined) {
      poisonedMovesLeft[poisonKey]--;
    }
  }
  updatePoisonedJewels(); // Sprawdź, czy któraś trucizna się rozprzestrzenia
}

function removeMatches() {
  if (gameState === "gameover") return false;
  let matchesFoundThisPass = false;
  let marks = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

  // Oznaczanie dopasowań kolorowych klejnotów
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === null || board[y][x] === POISON_JEWEL_TYPE) continue;
      let currentMatches = getMatches(x, y);
      if (currentMatches.length >= 3) {
        currentMatches.forEach(({ x: mx, y: my }) => marks[my][mx] = true);
        matchesFoundThisPass = true;
      }
    }
  }

  if (matchesFoundThisPass) {
    // Oznaczanie zatrutych klejnotów sąsiadujących z dopasowaniem
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (marks[r][c] && board[r][c] !== POISON_JEWEL_TYPE) { // Jeśli to dopasowany kolorowy klejnot
          const neighbors = [{x:c,y:r-1},{x:c,y:r+1},{x:c-1,y:r},{x:c+1,y:r}];
          for (const n of neighbors) {
            if (n.x >= 0 && n.x < COLS && n.y >= 0 && n.y < ROWS &&
                board[n.y][n.x] === POISON_JEWEL_TYPE && !marks[n.y][n.x]) { // Jeśli sąsiad jest zatruty
              marks[n.y][n.x] = true; // Oznacz go do usunięcia
            }
          }
        }
      }
    }

    playSound("match");
    popping = [];
    let actualPoisonEffectCreated = false; // Aby cząsteczki trucizny pojawiły się tylko raz na turę

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (marks[y][x]) {
          let originalBoardType = board[y][x]; // Co było na planszy przed usunięciem
          let wasActivePoison = isPoisonedJewel(x,y); // Czy był na liście *aktywnych* trucizn

          if (wasActivePoison) { // Jeśli to był aktywny zatruty klejnot
            const pIndex = poisonedJewels.findIndex(p => p.x === x && p.y === y);
            if (pIndex > -1) {
              poisonedJewels.splice(pIndex, 1); // Usuń z listy aktywnych
            }
            delete poisonedMovesLeft[`${x},${y}`]; // Usuń jego licznik
            if(!actualPoisonEffectCreated){
              createParticles(canvas.width / 2, canvas.height / 2, "rgba(44,62,80,0.9)", 30);
              actualPoisonEffectCreated = true;
            }
          }
          // Dodaj do animacji zniknięcia, 'type' to to, co było na planszy
          popping.push({ x, y, progress: 0, type: originalBoardType, wasPoison: wasActivePoison });
          let pColor = wasActivePoison ? "rgba(44,62,80,0.7)" : (jewelImages[originalBoardType] ? "rgba(200,200,200,0.7)" : "rgba(128,128,128,0.7)");
          createParticles(x * SIZE + SIZE / 2, (y * SIZE + SIZE / 2) + HEADER_HEIGHT, pColor, 10);
          board[y][x] = null; // Oznacz pole jako puste PRZED uzupełnieniem
        }
      }
    }

    animatePop(() => {
      if (gameState === "gameover") return; // Jeśli gra zakończyła się w trakcie animacji

      let pointsFromThisRound = 0;
      popping.forEach(p => { pointsFromThisRound += p.wasPoison ? 20 : 10; });
      score += pointsFromThisRound;
      if (scoreDiv) scoreDiv.textContent = "Wynik: " + score;
      if (score > recordScore) { recordScore = score; updateRecordScoreDisplay(); }

      // Uzupełnianie planszy
      for (let x = 0; x < COLS; x++) {
        let emptySlots = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
          if (board[y][x] === null) { // Jeśli pole jest teraz puste
            emptySlots++;
          } else if (emptySlots > 0) { // Jeśli są puste miejsca poniżej, przesuń klejnot
            board[y + emptySlots][x] = board[y][x];
            board[y][x] = null; // Poprzednie miejsce staje się puste
          }
        }
        for (let y = 0; y < emptySlots; y++) { // Uzupełnij puste miejsca od góry
          board[y][x] = randJewel();
        }
      }
      popping = []; // Wyczyść listę znikających klejnotów

      // Po uzupełnieniu, sprawdź rekursywnie czy są nowe dopasowania
      if (!removeMatches() && gameState !== "gameover") {
          // Jeśli NIE MA już więcej reakcji łańcuchowych I gra się nie skończyła
          if (!checkForPossibleMoves()) {
              if (gameState !== "gameover") { playSound("gameover"); gameOver("Brak ruchów!"); }
          } else {
              // Gra kontynuuje, zezwól na ruch gracza
              animating = false;
              lastMoveTime = Date.now(); // Reset timera podpowiedzi
              scheduleHintTimer();
          }
      }
      // Jeśli removeMatches() zwróciło true, to ono samo obsłuży dalsze sprawdzanie
    });
    return true; // Dopasowania znalezione i przetworzone
  }
  return false; // Brak dopasowań w tej iteracji
}

function animatePop(onComplete) {
  animating = true;
  let start = null;
  function popFrame(ts) {
    if (gameState === "gameover") { // Przerwij animację, jeśli gra się zakończyła
        popping = []; // Wyczyść, aby nie rysować ich na ekranie gameover
        if(typeof onComplete === 'function') onComplete();
        return;
    }
    if (!start) start = ts;
    let t = (ts - start) / 350; // Czas trwania animacji
    popping.forEach(p => p.progress = Math.min(1, t));
    if (t < 1) {
      requestAnimationFrame(popFrame);
    } else {
      if(typeof onComplete === 'function') onComplete();
    }
  }
  requestAnimationFrame(popFrame);
}

function animateSwap(x1, y1, x2, y2, onComplete, reverse = false) {
  animating = true;
  let start = null;
  const jewelType1 = board[y1][x1]; // Typy są już kolorowe, nie POISON_JEWEL_TYPE
  const jewelType2 = board[y2][x2];

  function swapFrame(ts) {
    if (gameState === "gameover") { // Przerwij animację
        if(typeof onComplete === 'function') onComplete();
        return;
    }
    if (!start) start = ts;
    let t = Math.min(1, (ts - start) / 200); // Czas trwania animacji
    
    swapAnim = { x1, y1, x2, y2, progress: reverse ? 1 - t : t }; 
    
    const currentProgress = reverse ? 1 - t : t;
    const sx = x1 * SIZE;
    const sy = y1 * SIZE + HEADER_HEIGHT;
    const dx = x2 * SIZE;
    const dy = y2 * SIZE + HEADER_HEIGHT;
    const jewelDrawSizeSwap = SIZE * JEWEL_VISUAL_SCALE;

    // Rysowanie pierwszego klejnotu
    ctx.save();
    ctx.translate(sx + (dx - sx) * currentProgress + SIZE / 2, sy + (dy - sy) * currentProgress + SIZE / 2);
    let scale1 = 1;
    if (selected && selected.x === x1 && selected.y === y1) scale1 = 1.1;
    ctx.scale(scale1, scale1);
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    if (selected && selected.x === x1 && selected.y === y1) { ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 3; }
    let img1 = (jewelType1 >=0 && jewelType1 < jewelImages.length ? jewelImages[jewelType1] : null);
    if (img1 && img1.complete) {
      ctx.drawImage(img1, -jewelDrawSizeSwap / 2, -jewelDrawSizeSwap / 2, jewelDrawSizeSwap, jewelDrawSizeSwap);
    } else {
      ctx.fillStyle = 'grey';
      ctx.fillRect(-jewelDrawSizeSwap/2, -jewelDrawSizeSwap/2, jewelDrawSizeSwap, jewelDrawSizeSwap);
    }
    ctx.restore();

    // Rysowanie drugiego klejnotu
    ctx.save();
    ctx.translate(dx + (sx - dx) * currentProgress + SIZE / 2, dy + (sy - dy) * currentProgress + SIZE / 2);
    let scale2 = 1;
    if (selected && selected.x === x2 && selected.y === y2) scale2 = 1.1;
    ctx.scale(scale2, scale2);
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    if (selected && selected.x === x2 && selected.y === y2) { ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 3; }
    let img2 = (jewelType2 >=0 && jewelType2 < jewelImages.length ? jewelImages[jewelType2] : null);
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
      if(typeof onComplete === 'function') onComplete();
    }
  }
  requestAnimationFrame(swapFrame);
}

function animate() {
  draw(performance.now()); // Zawsze wywołuj draw, logika wewnątrz draw decyduje co rysować
  requestAnimationFrame(animate);
}

// Główna inicjalizacja po załadowaniu strony
loadJewelImages(() => {
  console.log("All jewel images loaded.");
  updateRecordScoreDisplay(); // Inicjalne wyświetlenie rekordu
  settingsMenuButtons[2].text = `GAME MODE: ${gameMode.toUpperCase()}`; // Ustaw na podstawie domyślnego trybu
  animate(); 
  
  // Uruchomienie muzyki po pierwszej interakcji użytkownika
  let musicStarted = false;
  function tryStartMusic() {
    if (!musicStarted && musicEnabled && (gameState === "game" || gameState === "menu" || gameState === "modeSelection")) {
      playGameMusic();
      musicStarted = true;
    }
  }
  document.addEventListener("mousedown", tryStartMusic, { once: true });
  document.addEventListener("keydown", tryStartMusic, { once: true });
});