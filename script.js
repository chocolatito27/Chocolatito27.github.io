document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');
    const comprarSection = document.getElementById('comprar');
    
    // Toggle para el menú
    menuToggle.addEventListener('click', function () {
        menu.classList.toggle('active');
    });

    // Mostrar sección de comprar al hacer clic
    document.getElementById('comprar-option').addEventListener('click', function (event) {
        event.preventDefault(); // Evitar el comportamiento predeterminado del enlace
        // Ocultar otras secciones si las tienes
        // Mostrar la sección de comprar
        comprarSection.style.display = 'block';
    });
});
