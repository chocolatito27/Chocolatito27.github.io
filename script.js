// Toggle del menú
document.getElementById('menu-toggle').addEventListener('click', function () {
    document.getElementById('menu').classList.toggle('show');
});

// Mostrar u ocultar opciones de compra al hacer clic en "Comprar"
document.getElementById('buy-option').addEventListener('click', function (e) {
    e.preventDefault();
    const buyOptions = document.getElementById('buy-options');
    buyOptions.style.display = buyOptions.style.display === 'block' ? 'none' : 'block'; // Alterna la visibilidad
});

// Mostrar la sección de compras al hacer clic en "Compras"
document.getElementById('compras-option').addEventListener('click', function (e) {
    e.preventDefault();
    const comprasSection = document.getElementById('compras');
    comprasSection.style.display = comprasSection.style.display === 'block' ? 'none' : 'block'; // Alterna la visibilidad
});

// Calificación de la frase
const stars = document.querySelectorAll('.star');
stars.forEach(star => {
    star.addEventListener('click', function () {
        const rating = this.dataset.value;
        stars.forEach(s => s.classList.remove('selected')); // Limpiar selección anterior
        for (let i = 0; i < rating; i++) {
            stars[i].classList.add('selected'); // Seleccionar estrellas
        }
        alert(`Has calificado la frase con ${rating} estrella(s).`);
    });
});
