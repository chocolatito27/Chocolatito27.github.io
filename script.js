document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');
    const comprarSection = document.getElementById('comprar');
    const comprasSection = document.getElementById('compras');
    
    // Toggle para el menú
    menuToggle.addEventListener('click', function () {
        menu.classList.toggle('active');
    });

    // Mostrar sección de comprar al hacer clic
    document.getElementById('comprar-option').addEventListener('click', function (event) {
        event.preventDefault(); // Evitar el comportamiento predeterminado del enlace
        comprarSection.style.display = 'block';
        comprasSection.style.display = 'none'; // Asegurarse de ocultar la sección de compras
    });

    // Mostrar sección de compras al hacer clic
    document.getElementById('compras-option').addEventListener('click', function (event) {
        event.preventDefault(); // Evitar el comportamiento predeterminado del enlace
        comprasSection.style.display = 'block';
        comprarSection.style.display = 'none'; // Asegurarse de ocultar la sección de comprar
    });

    // Manejo de calificación de estrellas
    const stars = document.querySelectorAll('.star');
    const ratingResult = document.getElementById('rating-result');

    stars.forEach(star => {
        star.addEventListener('click', function () {
            const value = this.getAttribute('data-value');
            ratingResult.innerHTML = `Calificación: ${value} estrellas`;
            stars.forEach(s => s.classList.remove('selected')); // Limpiar selección
            for (let i = 0; i < value; i++) {
                stars[i].classList.add('selected'); // Marcar estrellas
            }
        });
    });
});
