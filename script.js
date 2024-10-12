document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');
    const starRating = document.getElementById('star-rating');

    // Menú desplegable
    menuToggle.addEventListener('click', function () {
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    });

    // Función para mostrar el feedback de calificación
    starRating.addEventListener('click', function (e) {
        if (e.target.classList.contains('star')) {
            const ratingValue = e.target.getAttribute('data-value');
            alert("Has calificado la frase con " + ratingValue + " estrellas.");
        }
    });
});
