document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("menu");
    const comprarSection = document.getElementById("comprar");
    const jueguitoSection = document.getElementById("jueguito");

    menuToggle.addEventListener("click", function() {
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.getElementById("comprar-option").addEventListener("click", function() {
        menu.style.display = "none";
        comprarSection.style.display = "block";
        jueguitoSection.style.display = "none";
    });

    document.getElementById("jueguito-option").addEventListener("click", function() {
        menu.style.display = "none";
        comprarSection.style.display = "none";
        jueguitoSection.style.display = "block";
        startGame();
    });

    // Jueguito
    let canvas = document.getElementById("gameCanvas");
    let ctx = canvas.getContext("2d");
    let score = 0;
    let isJumping = false;
    let playerY = 300;
    let gravity = 2;
    let obstacleX = 800;
    let gameInterval;

    function startGame() {
        score = 0;
        playerY = 300;
        obstacleX = 800;
        isJumping = false;

        if (gameInterval) clearInterval(gameInterval);

        gameInterval = setInterval(updateGame, 20);
    }

    function updateGame() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw player
        ctx.fillStyle = "#6a0572"; // Chocolate color
        ctx.fillRect(100, playerY, 50, 50);

        // Draw obstacle
        ctx.fillStyle = "#d62828";
        ctx.fillRect(obstacleX, 300, 20, 50);

        // Update obstacle position
        obstacleX -= 5;
        if (obstacleX < 0) obstacleX = canvas.width;

        // Apply gravity
        if (!isJumping) playerY += gravity;
        if (playerY > 300) playerY = 300;

        // Check collision
        if (obstacleX < 150 && obstacleX > 100 && playerY >= 250) {
            clearInterval(gameInterval);
            alert("¡Juego terminado! Puntaje: " + score);
        }

        // Update score
        score++;
        document.getElementById("score").innerText = "Puntaje: " + score;
    }

    document.addEventListener("click", function(e) {
        if (e.key === " " && playerY === 300) {
            isJumping = true;
            let jumpCount = 0;

            const jumpInterval = setInterval(() => {
                playerY -= 5;
                jumpCount++;
                if (jumpCount > 20) {
                    clearInterval(jumpInterval);
                    isJumping = false;
                }
            }, 20);
        }
    });
});
document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("menu");
    const comprarSection = document.getElementById("comprar");
    const jueguitoSection = document.getElementById("jueguito");

    menuToggle.addEventListener("click", function() {
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    document.getElementById("comprar-option").addEventListener("click", function() {
        menu.style.display = "none";
        comprarSection.style.display = "block";
        jueguitoSection.style.display = "none";
    });

    document.getElementById("jueguito-option").addEventListener("click", function() {
        menu.style.display = "none";
        comprarSection.style.display = "none";
        jueguitoSection.style.display = "block";
        startJueguito();
    });

    function startJueguito() {
        const canvas = document.getElementById("jueguito-canvas");
        const ctx = canvas.getContext("2d");

        let chocolate = { x: 50, y: 350, width: 50, height: 50, isJumping: false, velocity: 0 };
        let obstacles = [];
        let score = 0;
        let gameInterval;

        function createObstacle() {
            obstacles.push({ x: canvas.width, y: 350, width: 20, height: 50 });
        }

        function drawChocolate() {
            ctx.fillStyle = "brown";
            ctx.fillRect(chocolate.x, chocolate.y, chocolate.width, chocolate.height);
        }

        function drawObstacles() {
            ctx.fillStyle = "red";
            obstacles.forEach(obstacle => {
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            });
        }

        function updateGame() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            drawChocolate();
            drawObstacles();

            chocolate.velocity += 1;
            chocolate.y += chocolate.velocity;

            if (chocolate.y > 350) {
                chocolate.y = 350;
                chocolate.isJumping = false;
            }

            obstacles.forEach((obstacle, index) => {
                obstacle.x -= 5;

                if (obstacle.x + obstacle.width < 0) {
                    obstacles.splice(index, 1);
                    score++;
                }

                if (
                    chocolate.x < obstacle.x + obstacle.width &&
                    chocolate.x + chocolate.width > obstacle.x &&
                    chocolate.y < obstacle.y + obstacle.height &&
                    chocolate.y + chocolate.height > obstacle.y
                ) {
                    clearInterval(gameInterval);
                    alert("¡Perdiste! Puntaje: " + score);
                }
            });

            document.getElementById("jueguito-score").textContent = `Puntaje: ${score}`;
        }

        document.addEventListener("keydown", function(e) {
            if (e.code === "Space" && !chocolate.isJumping) {
                chocolate.isJumping = true;
                chocolate.velocity = -15;
            }
        });

        createObstacle();
        gameInterval = setInterval(() => {
            createObstacle();
            updateGame();
        }, 20);
    }
});
