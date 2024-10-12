document.getElementById('menu-toggle').addEventListener('click', function() {
    const menu = document.getElementById('menu');
    if (menu.style.display === 'block') {
        menu.style.display = 'none';
    } else {
        menu.style.display = 'block';
    }
});

document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', function() {
        const rating = this.dataset.value;
        const message = document.querySelector('.life-quote');
        
        // Mostrar carita según la calificación
        if (rating == 1) {
            message.textContent += ' 😢';
        } else if (rating == 2) {
            message.textContent += ' 🙁';
        } else if (rating == 3) {
            message.textContent += ' 😐';
        } else if (rating == 4) {
            message.textContent += ' 🙂';
        } else if (rating == 5) {
            message.textContent += ' 😀';
        }

        // Reseteo la calificación
        document.querySelectorAll('.star').forEach(star => {
            star.classList.remove('selected');
        });
        this.classList.add('selected');
    });
});
