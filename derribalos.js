document.addEventListener('DOMContentLoaded', () => {
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
  let enemySpawnRate = 1000;
  let lastEnemySpawn = 0;
  let isTouchDevice = 'ontouchstart' in window;
  let gameOver = false;

  // Obtener elementos
  const naveImg = document.getElementById('nave');
  const creatureImg = document.getElementById('creature');
  const explosionImg = document.getElementById('explosion');
  const restartButton = document.getElementById('restartButton');
  const scoreDisplay = document.getElementById('score');
  const levelDisplay = document.getElementById('level');

  if (!canvas || !ctx || !naveImg || !creatureImg || !explosionImg || !restartButton) {
    console.error('❌ Error: Faltan elementos del DOM necesarios.');
    return;
  }

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
        if (this.explosionTime > 30) {
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
      this.speed = 4;
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
      this.angle = Math.random() * Math.PI * 2;
      this.amplitude = Math.random() * 50 + 50;
    }

    draw() {
      ctx.drawImage(creatureImg, this.x, this.y, this.width, this.height);
    }

    update() {
      this.angle += 0.02;
      this.x += Math.sin(this.angle) * 2;
      this.y += this.speed;
    }
  }

  function spawnEnemy() {
    enemies.push(new Enemy());
  }

  function updateGame() {
    if (gameOver) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.draw();

    bullets = bullets.filter(bullet => {
      bullet.update();
      bullet.draw();
      return bullet.y + bullet.height > 0;
    });

    enemies = enemies.filter(enemy => {
      enemy.update();
      enemy.draw();

      // Revisión de colisiones con balas
      bullets.forEach((bullet, bIndex) => {
        if (
          bullet.x < enemy.x + enemy.width &&
          bullet.x + bullet.width > enemy.x &&
          bullet.y < enemy.y + enemy.height &&
          bullet.y + bullet.height > enemy.y
        ) {
          bullets.splice(bIndex, 1);
          score += 10;
          scoreDisplay.innerText = score;
          enemy.hit = true; // Marcar para eliminar
        }
      });

      // Colisión con jugador
      if (
        player.x < enemy.x + enemy.width &&
        player.x + player.width > enemy.x &&
        player.y < enemy.y + enemy.height &&
        player.y + player.height > enemy.y &&
        !player.isExploding
      ) {
        player.explode();
      }

      return !enemy.hit && enemy.y < canvas.height;
    });

    // Spawneo de enemigos
    if (Date.now() - lastEnemySpawn > enemySpawnRate) {
      spawnEnemy();
      lastEnemySpawn = Date.now();
    }

    // Nivel arriba
    if (score >= level * 100) {
      level++;
      enemySpeed += 0.5;
      enemySpawnRate = Math.max(200, enemySpawnRate - 100); // Límite mínimo
      levelDisplay.innerText = level;
    }

    // Disparo automático en móvil
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
    const touchX = e.touches[0].clientX;
    player.moveTo(touchX);
  }

  function restartGame() {
    score = 0;
    level = 1;
    enemySpeed = 1;
    enemySpawnRate = 1000;
    gameOver = false;
    bullets = [];
    enemies = [];
    player = new Player();
    scoreDisplay.innerText = score;
    levelDisplay.innerText = level;
    restartButton.classList.add('hidden');
    updateGame();
  }

  // Inicialización
  player = new Player();
  window.addEventListener('keydown', handleKeyDown);
  if (isTouchDevice) {
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
  }
  restartButton.addEventListener('click', restartGame);
  updateGame();
});
