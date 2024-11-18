document.addEventListener("DOMContentLoaded", function() {
    const menuToggle = document.getElementById("menu-toggle");
    const menu = document.getElementById("menu");
    const comprarSection = document.getElementById("comprar");
    const jueguitoSection = document.getElementById("jueguito");

    // Toggle del menú
    menuToggle.addEventListener("click", function() {
        menu.style.display = menu.style.display === "none" ? "block" : "none";
    });

    // Comprar
    document.getElementById("comprar-option").addEventListener("click", function() {
        menu.style.display = "none";
        comprarSection.style.display = "block";
        jueguitoSection.style.display = "none";
    });

    // Jueguito
    document.getElementById("jueguito-option").addEventListener("click", function() {
        menu.style.display = "none";
        comprarSection.style.display = "none";
        jueguitoSection.style.display = "block";
        startGame();
    });

    // Juego del chocolate
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");

    let chocolate = { x: 50, y: 350, width: 20, height: 20, isJumping: false, velocity: 0 };
    let obstacles = [];
    let score = 0;
    let gameInterval;
    let obstacleInterval;

    function startGame() {
        obstacles = [];
        score = 0;
        chocolate.y = 350;
        chocolate.isJumping = false;

        clearInterval(gameInterval);
        clearInterval(obstacleInterval);

        gameInterval = setInterval(updateGame, 20);
        obstacleInterval = setInterval(addObstacle, 2000);

        document.addEventListener("keydown", handleJump);
        canvas.addEventListener("touchstart", handleJump);
    }

    function handleJump(e) {
        if (e.type === "keydown" && e.code !== "Space") return;
        if (!chocolate.isJumping) {
            chocolate.isJumping = true;
            chocolate.velocity = -12;
        }
    }

    function addObstacle() {
        const size = Math.random() * 30 + 20;
        obstacles.push({ x: canvas.width, y: 380 - size, width: size, height: size });
    }

    function updateGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "brown";
        ctx.fillRect(chocolate.x, chocolate.y, chocolate.width, chocolate.height);

        if (chocolate.isJumping) {
            chocolate.velocity += 0.5;
            chocolate.y += chocolate.velocity;

            if (chocolate.y >= 350) {
                chocolate.y = 350;
                chocolate.isJumping = false;
            }
        }

        ctx.fillStyle = "red";
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
