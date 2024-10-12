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

// Mostrar un mensaje de confirmación al hacer clic en "Comprar"
document.getElementById('buy-button').addEventListener('click', function () {
    alert("¡Pedido realizado! Te contactaremos para más detalles.");
});
