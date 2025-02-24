const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let score = 0;
let level = 1;
let player;
let bullets = [];
let enemies = [];
let enemySpeed = 1;
let enemySpawnRate = 1000; // Tiempo en milisegundos
let lastEnemySpawn = 0;
let isTouchDevice = 'ontouchstart' in window;
let touchX = 0;
let gameOver = false;

// Cargar imágenes
const naveImg = document.getElementById('nave');
const bossImg = document.getElementById('boss');
const creatureImg = document.getElementById('creature');
const explosionImg = document.getElementById('explosion');

// Botón de reinicio
const restartButton = document.getElementById('restartButton');

class Player {
    constructor() {
        this.width = 50;
        this.height = 50;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - this.height - 10;
        this.speed = 5;
        this.isExploding = false;
        this.explosionTime = 0;
    }

    draw() {
        if (this.isExploding) {
            ctx.drawImage(explosionImg, this.x, this.y, this.width, this.height);
            this.explosionTime += 1;
            if (this.explosionTime > 30) { // Duración de la explosión
                gameOver = true;
                restartButton.classList.remove('hidden');
            }
        } else {
            ctx.drawImage(naveImg, this.x, this.y, this.width, this.height);
        }
    }

    move(direction) {
        if (direction === 'left' && this.x > 0) {
            this.x -= this.speed;
        } else if (direction === 'right' && this.x + this.width < canvas.width) {
            this.x += this.speed;
        }
    }

    moveTo(x) {
        this.x = x - this.width / 2;
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
    }

    explode() {
        this.isExploding = true;
    }
}

class Bullet {
    constructor(x, y) {
        this.width = 5;
        this.height = 15;
        this.x = x;
        this.y = y;
        this.speed = 4; // Balas más lentas
    }

    draw() {
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    update() {
        this.y -= this.speed;
    }
}

class Enemy {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = Math.random() * (canvas.width - this.width);
        this.y = -this.height;
        this.speed = enemySpeed;
        this.angle = Math.random() * Math.PI * 2; // Ángulo para movimiento elíptico/parabólico
        this.amplitude = Math.random() * 50 + 50; // Amplitud del movimiento
    }

    draw() {
        ctx.drawImage(creatureImg, this.x, this.y, this.width, this.height);
    }

    update() {
        // Movimiento elíptico/parabólico
        this.angle += 0.02;
        this.x += Math.sin(this.angle) * 2;
        this.y += this.speed;

        if (this.y > canvas.height) {
            this.y = -this.height;
            this.x = Math.random() * (canvas.width - this.width);
        }
    }
}

function spawnEnemy() {
    enemies.push(new Enemy());
}

function updateGame() {
    if (gameOver) {
        return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    player.draw();

    bullets.forEach((bullet, index) => {
        bullet.update();
        bullet.draw();

        if (bullet.y + bullet.height < 0) {
            bullets.splice(index, 1);
        }
    });

    enemies.forEach((enemy, eIndex) => {
        enemy.update();
        enemy.draw();

        bullets.forEach((bullet, bIndex) => {
            if (bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y) {
                enemies.splice(eIndex, 1);
                bullets.splice(bIndex, 1);
                score += 10;
                document.getElementById('score').innerText = score;
            }
        });

        // Colisión con el jugador
        if (player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y && !player.isExploding) {
            player.explode();
        }
    });

    if (Date.now() - lastEnemySpawn > enemySpawnRate) {
        spawnEnemy();
        lastEnemySpawn = Date.now();
    }

    if (score >= level * 100) {
        level++;
        enemySpeed += 0.5;
        enemySpawnRate -= 100;
        document.getElementById('level').innerText = level;
    }

    // Disparar automáticamente en dispositivos móviles
    if (isTouchDevice) {
        bullets.push(new Bullet(player.x + player.width / 2 - 2.5, player.y));
    }

    requestAnimationFrame(updateGame);
}

function handleKeyDown(e) {
    if (e.key === 'ArrowLeft') {
        player.move('left');
    } else if (e.key === 'ArrowRight') {
        player.move('right');
    } else if (e.key === ' ' && !isTouchDevice) {
        bullets.push(new Bullet(player.x + player.width / 2 - 2.5, player.y));
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    touchX = e.touches[0].clientX;
    player.moveTo(touchX);
}

function restartGame() {
    score = 0;
    level = 1;
    player = new Player();
    bullets = [];
    enemies = [];
    enemySpeed = 1;
    enemySpawnRate = 1000;
    gameOver = false;
    restartButton.classList.add('hidden');
    document.getElementById('score').innerText = score;
    document.getElementById('level').innerText = level;
    updateGame();
}

player = new Player();
window.addEventListener('keydown', handleKeyDown);
if (isTouchDevice) {
    window.addEventListener('touchmove', handleTouchMove);
}
restartButton.addEventListener('click', restartGame);
updateGame();
