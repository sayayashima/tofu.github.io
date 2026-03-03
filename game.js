const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const pauseOverlay = document.getElementById('pauseOverlay');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const resumeButton = document.getElementById('resumeButton');
const pauseButton = document.getElementById('pauseButton');
const finalScoreText = document.getElementById('finalScoreText');
const highScoreText = document.getElementById('highScoreText');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Game state
let gameState = 'START'; // START, PLAYING, PAUSED, GAME_OVER
let score = 0;
let highScore = parseInt(localStorage.getItem('fruitCatchHighScore')) || 0;
let lives = 3;
let basketX = canvas.width / 2;
let basketWidth = 120;
let basketHeight = 35;
let fallingItems = [];
let particles = [];
let spawnTimer = 0;
let spawnInterval = 70;
let difficultyTimer = 0;
let combo = 0;
let lastCatchTime = 0;

// Item types
// Item types (Subjects Version)
const itemTypes = [
    { emoji: '💻', name: 'IT', isBomb: false, points: 50, color: '#00b894' },     // Highest points
    { emoji: '📚', name: 'English', isBomb: false, points: 20, color: '#0984e3' },
    { emoji: '🧪', name: 'Science', isBomb: false, points: 25, color: '#6c5ce7' },
    { emoji: '🌍', name: 'Geography', isBomb: false, points: 15, color: '#fdcb6e' },
    { emoji: '📜', name: 'History', isBomb: false, points: 10, color: '#e17055' },
    { emoji: '🎨', name: 'Art', isBomb: false, points: 30, color: '#e84393' },
    { emoji: '📐', name: 'Math', isBomb: true, points: -30, color: '#d63031' },   // Bomb
    { emoji: '⭐', name: 'Bonus', isBomb: false, points: 0, special: 'double' },  // Double points
    { emoji: '❄️', name: 'Freeze', isBomb: false, points: 0, special: 'slow' },  // Slow motion
    { emoji: '❤️', name: 'Life', isBomb: false, points: 0, special: 'life' }     // Extra life
];


// Particle for visual effects
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.radius = 2 + Math.random() * 3;
        this.color = color;
        this.speedX = (Math.random() - 0.5) * 4;
        this.speedY = (Math.random() - 0.5) * 4;
        this.life = 1;
        this.decay = 0.03;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// Falling item
class FallingItem {
    constructor() {
        const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        this.emoji = type.emoji;
        this.isBomb = type.isBomb;
        this.points = type.points;
        this.special = type.special || null;

        this.size = 40;
        this.x = this.size + Math.random() * (canvas.width - this.size * 2);
        this.y = -this.size;
        this.baseSpeed = 2 + Math.random() * 2;
        this.speed = this.baseSpeed;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    }

    update(slowFactor = 1) {
        this.y += this.speed * slowFactor;
        this.rotation += this.rotationSpeed;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.font = `${this.size + 6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 3, 3);

        // Item
        ctx.font = `${this.size}px Arial`;
        ctx.fillStyle = '#fff';
        ctx.fillText(this.emoji, 0, 0);

        ctx.restore();
    }

    isOffScreen() {
        return this.y > canvas.height + this.size;
    }

    checkCatch(basketX, basketY) {
        const basketLeft = basketX - basketWidth / 2;
        const basketRight = basketX + basketWidth / 2;
        const basketTop = basketY - basketHeight / 2;

        return this.x > basketLeft &&
               this.x < basketRight &&
               this.y > basketTop - this.size / 2 &&
               this.y < basketTop + this.size / 2;
    }
}

// Input handling
function handleMove(e) {
    if (gameState !== 'PLAYING') return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    basketX = touch.clientX;

    if (basketX < basketWidth / 2) basketX = basketWidth / 2;
    if (basketX > canvas.width - basketWidth / 2) basketX = canvas.width - basketWidth / 2;
}

canvas.addEventListener('touchstart', handleMove);
canvas.addEventListener('touchmove', handleMove);
canvas.addEventListener('mousemove', handleMove);

// Buttons
startButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    resetGame();
    gameState = 'PLAYING';
});

restartButton.addEventListener('click', () => {
    gameOverScreen.classList.add('hidden');
    resetGame();
    gameState = 'PLAYING';
});

pauseButton.addEventListener('click', () => {
    if (gameState === 'PLAYING') {
        gameState = 'PAUSED';
        pauseOverlay.classList.remove('hidden');
    } else if (gameState === 'PAUSED') {
        gameState = 'PLAYING';
        pauseOverlay.classList.add('hidden');
    }
});

resumeButton.addEventListener('click', () => {
    pauseOverlay.classList.add('hidden');
    gameState = 'PLAYING';
});

// Game reset
function resetGame() {
    score = 0;
    lives = 3;
    combo = 0;
    fallingItems = [];
    particles = [];
    spawnTimer = 0;
    spawnInterval = 70;
    difficultyTimer = 0;
    basketX = canvas.width / 2;
}

// Spawn item
function spawnItem() {
    fallingItems.push(new FallingItem());
}

// Create explosion particles
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Main game loop
let lastTime = 0;
let slowMotionTimer = 0;

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background: sky gradient is in CSS, here we add clouds & parallax hills
    drawBackground();

    if (gameState === 'PLAYING') {
        updateGame(delta);
    }

    drawGame();
}

function updateGame(delta) {
    const basketY = canvas.height - 70;

    // Difficulty scaling
    difficultyTimer += delta;
    if (difficultyTimer > 5000) { // every 5 seconds
        difficultyTimer = 0;
        if (spawnInterval > 30) spawnInterval -= 3;
    }

    // Slow motion effect timer
    if (slowMotionTimer > 0) {
        slowMotionTimer -= delta;
        if (slowMotionTimer < 0) slowMotionTimer = 0;
    }
    const slowFactor = slowMotionTimer > 0 ? 0.4 : 1;

    // Spawn items
    spawnTimer += delta / 16.67; // normalize to ~60fps
    if (spawnTimer >= spawnInterval) {
        spawnItem();
        spawnTimer = 0;
    }

    // Update items
    for (let i = fallingItems.length - 1; i >= 0; i--) {
        const item = fallingItems[i];
        item.update(slowFactor);

        if (item.checkCatch(basketX, basketY)) {
            handleCatch(item);
            fallingItems.splice(i, 1);
            continue;
        }

        if (item.isOffScreen()) {
            if (!item.isBomb) {
                lives--;
                combo = 0;
                if (navigator.vibrate) navigator.vibrate(80);
            }
            fallingItems.splice(i, 1);
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].isDead()) {
            particles.splice(i, 1);
        }
    }

    // Game over
    if (lives <= 0 && gameState === 'PLAYING') {
        gameState = 'GAME_OVER';
        endGame();
    }
}

function handleCatch(item) {
    const now = performance.now();
    const timeDiff = now - lastCatchTime;
    lastCatchTime = now;

    // Combo logic
    if (!item.isBomb) {
        if (timeDiff < 800) {
            combo++;
        } else {
            combo = 1;
        }
    } else {
        combo = 0;
    }

    // Visual explosion
    const color = item.isBomb ? '#ff4757' : '#ffeaa7';
    createExplosion(item.x, item.y, color);

    if (item.isBomb) {
        lives -= 2;
        if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    } else {
        let gained = item.points;

        // Special effects
        if (item.special === 'double') {
            gained *= 2;
        } else if (item.special === 'slow') {
            slowMotionTimer = 3000; // 3 seconds
        } else if (item.special === 'life') {
            lives = Math.min(lives + 1, 5);
        }

        // Combo bonus
        if (combo >= 3) {
            gained += combo * 2;
        }

        score += gained;
    }
}

function endGame() {
    finalScoreText.textContent = `Score: ${score}`;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('fruitCatchHighScore', highScore);
    }
    highScoreText.textContent = `High Score: ${highScore}`;
    gameOverScreen.classList.remove('hidden');
}

// Drawing
function drawBackground() {
    // Ground
    const groundHeight = 60;
    ctx.fillStyle = '#7ec850';
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

    // Hills
    ctx.fillStyle = '#5ba63b';
    const hillY = canvas.height - groundHeight;
    ctx.beginPath();
    ctx.ellipse(canvas.width * 0.3, hillY + 40, 200, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(canvas.width * 0.7, hillY + 50, 250, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Clouds
    drawCloud(canvas.width * 0.2, 100, 40);
    drawCloud(canvas.width * 0.6, 60, 30);
    drawCloud(canvas.width * 0.85, 130, 35);
}

function drawCloud(x, y, size) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x + size * 0.8, y + 10, size * 0.8, 0, Math.PI * 2);
    ctx.arc(x - size * 0.8, y + 10, size * 0.8, 0, Math.PI * 2);
    ctx.fill();
}

function drawGame() {
    const basketY = canvas.height - 70;

    // Draw falling items
    for (let i = 0; i < fallingItems.length; i++) {
        fallingItems[i].draw();
    }

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
        particles[i].draw();
    }

    // Draw basket
    drawBasket(basketX, basketY);

    // UI
    drawUI();
}

function drawBasket(x, y) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + basketHeight / 2 + 8, basketWidth * 0.6, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const grd = ctx.createLinearGradient(0, y - basketHeight, 0, y + basketHeight);
    grd.addColorStop(0, '#b87333');
    grd.addColorStop(1, '#8b4513');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.roundRect(x - basketWidth / 2, y - basketHeight / 2, basketWidth, basketHeight, 10);
    ctx.fill();

    // Stripes
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x - basketWidth / 2 + 10, y - basketHeight / 2 + i * 5 + 10);
        ctx.lineTo(x + basketWidth / 2 - 10, y - basketHeight / 2 + i * 5 + 10);
        ctx.stroke();
    }

    // Handles
    ctx.strokeStyle = '#5a2e0f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x - basketWidth / 3, y - basketHeight / 2, 14, Math.PI, 0, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + basketWidth / 3, y - basketHeight / 2, 14, Math.PI, 0, false);
    ctx.stroke();
}

function drawUI() {
    // Score & lives
    ctx.fillStyle = '#2d3436';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + score, 20, 40);

    ctx.textAlign = 'right';
    ctx.fillText('Lives: ' + lives, canvas.width - 20, 40);

    // Hearts
    ctx.fillStyle = '#e74c3c';
    for (let i = 0; i < lives; i++) {
        ctx.beginPath();
        ctx.arc(canvas.width - 120 + i * 24, 60, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    // Combo
    if (combo >= 2) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('Combo x' + combo, canvas.width / 2, 40);
    }

    // Instruction (only while playing and early)
    if (gameState === 'PLAYING' && score < 50) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Drag or move your finger to move the basket!', canvas.width / 2, canvas.height - 20);
    }
}

// Start loop
requestAnimationFrame(gameLoop);