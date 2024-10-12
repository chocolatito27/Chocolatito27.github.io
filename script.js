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
