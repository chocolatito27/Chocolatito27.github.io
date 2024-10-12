document.addEventListener('DOMContentLoaded', function () {
    const menuToggle = document.getElementById('menu-toggle');
    const menu = document.getElementById('menu');
    const starRating = document.getElementById('star-rating');
    const feedbackFace = document.getElementById('feedback-face');

    // Menú desplegable
    menuToggle.addEventListener('click', function () {
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    });

    // Función para actualizar la cara de calificación según la selección de estrellas
    starRating.addEventListener('click', function (e) {
        if (e.target.classList.contains('star')) {
            const ratingValue = e.target.getAttribute('data-value');
            updateFace(ratingValue);
        }
    });

    // Función para cambiar la carita según el valor de las estrellas
    function updateFace(value) {
        switch (value) {
            case '1':
                feedbackFace.textContent = '😢'; // Carita triste
                break;
            case '2':
                feedbackFace.textContent = '😟'; // Carita no tan triste
                break;
            case '3':
                feedbackFace.textContent = '😐'; // Carita neutral
                break;
            case '4':
                feedbackFace.textContent = '🙂'; // Carita medio feliz
                break;
            case '5':
                feedbackFace.textContent = '😁'; // Carita feliz
                break;
            default:
                feedbackFace.textContent = '😐'; // Carita por defecto
        }
    }
});
