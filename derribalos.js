
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");


// Controles táctiles
function moveLeft(isMoving) {
    player.isMovingLeft = isMoving;
}

function moveRight(isMoving) {
    player.isMovingRight = isMoving;
}
// Resto del código del juego...
// Cargar imágenes y sonidos
const playerImage = new Image();
playerImage.src = "nave.png";

const enemyImage = new Image();
enemyImage.src = "creature.gif";

const bossImage = new Image();
bossImage.src = "boss.gif";

const bulletImage = new Image();
bulletImage.src = "bullet.png";

const explosionImage = new Image();
explosionImage.src = "explosion.png";

const shootSound = new Audio("shoot.mp3");
const explosionSound = new Audio("explosion.mp3");
const backgroundMusic = new Audio("background.mp3");
backgroundMusic.loop = true;

// Variables del juego
let player = {
    x: canvas.width / 2 - 25,
    y: canvas.height - 60,
    width: 50,
    height: 50,
    speed: 5,
    isMovingLeft: false,
    isMovingRight: false
};

let bullets = [];
let enemies = [];
let boss = null;
let score = 0;
let level = 1;
let gameOver = false;
let stars = [];
let explosions = [];

// Crear estrellas para el fondo
function createStars() {
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 1 + 0.5
        });
    }
}

// Dibujar estrellas
function drawStars() {
    ctx.fillStyle = "white";
    stars.forEach((star) => {
        ctx.fillRect(star.x, star.y, star.size, star.size);
        star.y += star.speed;

        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
}

// Dibujar al jugador
function drawPlayer() {
    ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
}

// Mover al jugador
function movePlayer() {
    if (player.isMovingLeft && player.x > 0) {
        player.x -= player.speed;
    }
    if (player.isMovingRight && player.x < canvas.width - player.width) {
        player.x += player.speed;
    }
}

// Disparar balas
function shoot() {
    bullets.push({
        x: player.x + player.width / 2 - 2.5,
        y: player.y,
        width: 5,
        height: 10,
        speed: 7
    });
    shootSound.play();
}

// Dibujar balas
function drawBullets() {
    bullets.forEach((bullet, index) => {
        ctx.drawImage(bulletImage, bullet.x, bullet.y, bullet.width, bullet.height);
        bullet.y -= bullet.speed;

        if (bullet.y + bullet.height < 0) {
            bullets.splice(index, 1);
        }
    });
}

// Crear enemigos
function createEnemies() {
    for (let i = 0; i < level * 3; i++) {
        enemies.push({
            x: Math.random() * (canvas.width - 50),
            y: -50,
            width: 50,
            height: 50,
            speed: 2 + level * 0.5
        });
    }
}

// Dibujar enemigos
function drawEnemies() {
    enemies.forEach((enemy, index) => {
        ctx.drawImage(enemyImage, enemy.x, enemy.y, enemy.width, enemy.height);
        enemy.y += enemy.speed;

        if (enemy.y > canvas.height) {
            enemies.splice(index, 1);
        }
    });
}

// Crear jefe final
function createBoss() {
    if (level % 5 === 0) {
        boss = {
            x: canvas.width / 2 - 75,
            y: -100,
            width: 150,
            height: 100,
            speed: 1,
            health: level * 10
        };
    }
}

// Dibujar jefe final
function drawBoss() {
    if (boss) {
        ctx.drawImage(bossImage, boss.x, boss.y, boss.width, boss.height);
        boss.y += boss.speed;

        if (boss.y > canvas.height) {
            boss = null;
        }
    }
}

// Crear explosión
function createExplosion(x, y) {
    explosions.push({
        x: x,
        y: y,
        frame: 0,
        maxFrames: 10
    });
    explosionSound.play();
}

// Dibujar explosiones
function drawExplosions() {
    explosions.forEach((explosion, index) => {
        ctx.drawImage(
            explosionImage,
            explosion.frame * 64, 0, 64, 64,
            explosion.x, explosion.y, 64, 64
        );
        explosion.frame++;

        if (explosion.frame >= explosion.maxFrames) {
            explosions.splice(index, 1);
        }
    });
}

// Verificar colisiones
function checkCollisions() {
    bullets.forEach((bullet, bulletIndex) => {
        enemies.forEach((enemy, enemyIndex) => {
            if (
                bullet.x < enemy.x + enemy.width &&
                bullet.x + bullet.width > enemy.x &&
                bullet.y < enemy.y + enemy.height &&
                bullet.y + bullet.height > enemy.y
            ) {
                bullets.splice(bulletIndex, 1);
                enemies.splice(enemyIndex, 1);
                score += 10;
                createExplosion(enemy.x, enemy.y);
            }
        });

        if (boss) {
            if (
                bullet.x < boss.x + boss.width &&
                bullet.x + bullet.width > boss.x &&
                bullet.y < boss.y + boss.height &&
                bullet.y + bullet.height > boss.y
            ) {
                bullets.splice(bulletIndex, 1);
                boss.health -= 1;
                if (boss.health <= 0) {
                    boss = null;
                    score += 50;
                    createExplosion(boss.x, boss.y);
                }
            }
        }
    });

    enemies.forEach((enemy) => {
        if (
            player.x < enemy.x + enemy.width &&
            player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height &&
            player.y + player.height > enemy.y
        ) {
            gameOver = true;
        }
    });

    if (boss) {
        if (
            player.x < boss.x + boss.width &&
            player.x + player.width > boss.x &&
            player.y < boss.y + boss.height &&
            player.y + player.height > boss.y
        ) {
            gameOver = true;
        }
    }
}

// Actualizar el juego
function updateGame() {
    if (gameOver) {
        alert(`Game Over! Puntos: ${score}`);
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStars();
    drawPlayer();
    movePlayer();
    drawBullets();
    drawEnemies();
    drawBoss();
    drawExplosions();
    checkCollisions();

    if (enemies.length === 0 && !boss) {
        level++;
        createEnemies();
        createBoss();
    }

    document.getElementById("score").textContent = score;
    document.getElementById("level").textContent = level;

    requestAnimationFrame(updateGame);
}

// Eventos de teclado
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") player.isMovingLeft = true;
    if (e.key === "ArrowRight") player.isMovingRight = true;
    if (e.key === " ") shoot();
});

document.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") player.isMovingLeft = false;
    if (e.key === "ArrowRight") player.isMovingRight = false;
});

// Iniciar el juego
createStars();
createEnemies();
backgroundMusic.play();
updateGame();