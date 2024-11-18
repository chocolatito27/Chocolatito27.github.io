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

    document.addEventListener("keydown", function(e) {
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
