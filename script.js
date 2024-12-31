document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("menu");
    const comprarSection = document.getElementById("comprar");

    menuToggle.addEventListener("click", function() {
        if (menu.style.display === "none") {
            menu.style.display = "block"; // Muestra el menú
        } else {
            menu.style.display = "none"; // Oculta el menú
        }
    });

    const comprarOption = document.getElementById("comprar-option");
    comprarOption.addEventListener("click", function() {
        menu.style.display = "none"; // Oculta el menú al seleccionar
        comprarSection.style.display = "block"; // Muestra la sección de compras
    });
});
document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("menu");
    const comprarSection = document.getElementById("comprar");
    const jueguitoSection = document.getElementById("jueguito");

    menuToggle.addEventListener("click", function() {
        menu.style.display = menu.style.display === "none" ? "block" : "none";
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

    // Juego del chocolate
    function startGame() {
        const canvas = document.getElementById("gameCanvas");
        const ctx = canvas.getContext("2d");
        const chocolate = { x: 50, y: 200, size: 30, dy: 0, jump: -10, gravity: 0.5 };
        const obstacles = [];
        let score = 0;
        let isGameOver = false;
        let heartDisplayed = false;

        function createObstacle() {
            const height = Math.random() * (200 - 50) + 50;
            obstacles.push({ x: canvas.width, y: 300 - height, width: 20, height: height });
        }

        function drawChocolate() {
            ctx.fillStyle = "brown";
            ctx.fillRect(chocolate.x, chocolate.y, chocolate.size, chocolate.size);
        }

        function drawObstacles() {
            ctx.fillStyle = "black";
            obstacles.forEach(obstacle => {
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            });
        }

        function drawScore() {
            ctx.fillStyle = "black";
            ctx.font = "20px Arial";
            ctx.fillText(`Puntos: ${score}`, 10, 20);
        }

        function drawHeart() {
            if (heartDisplayed) {
                ctx.fillStyle = "red";
                ctx.beginPath();
                ctx.arc(canvas.width / 2, 100, 20, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function updateGame() {
            if (isGameOver) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            chocolate.dy += chocolate.gravity;
            chocolate.y += chocolate.dy;
            if (chocolate.y + chocolate.size > canvas.height) {
                chocolate.y = canvas.height - chocolate.size;
                chocolate.dy = 0;
            }

            obstacles.forEach(obstacle => {
                obstacle.x -= 5;
                if (obstacle.x + obstacle.width < 0) obstacles.shift();

                // Check collision
                if (
                    chocolate.x < obstacle.x + obstacle.width &&
                    chocolate.x + chocolate.size > obstacle.x &&
                    chocolate.y < obstacle.y + obstacle.height &&
                    chocolate.y + chocolate.size > obstacle.y
                ) {
                    isGameOver = true;
                    alert(`Game Over! Puntos totales: ${score}`);
                    window.location.reload();
                }
            });

            if (Math.random() < 0.02) createObstacle();

            score += 1;
            if (score === 100 && !heartDisplayed) {
                heartDisplayed = true;
                setTimeout(() => (heartDisplayed = false), 2000);
            }

            drawChocolate();
            drawObstacles();
            drawScore();
            drawHeart();

            requestAnimationFrame(updateGame);
        }

        document.addEventListener("keydown", function(e) {
            if (e.code === "Space" && chocolate.y + chocolate.size >= canvas.height) {
                chocolate.dy = chocolate.jump;
            }
        });

        updateGame();
    }
});
