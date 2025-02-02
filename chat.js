async function sendMessage() {
    let input = document.getElementById("input");
    let chat = document.getElementById("chat");
    let userMessage = input.value.trim();

    if (userMessage === "") return;

    // Agregar mensaje del usuario al chat
    chat.innerHTML += `<p class='user'>🧑‍💻 Tú: ${userMessage}</p>`;
    chat.innerHTML += `<p class='loading'>⏳ Pensando...</p>`;
    chat.scrollTop = chat.scrollHeight; // Auto-scroll

    input.value = "";

    try {
        let response = await fetch("https://cors-anywhere.herokuapp.com/https://chocolatitoapis.vercel.app/api/chat", {  
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userMessage })
});

        let data = await response.json();
        document.querySelector(".loading").remove(); // Quitar mensaje de "Pensando..."
        
        chat.innerHTML += `<p class='bot'>🤖 ${data.reply}</p>`;
    } catch (error) {
        chat.innerHTML += `<p class='error'>⚠️ Error: ${error.message}</p>`;
    }

    chat.scrollTop = chat.scrollHeight; // Auto-scroll
}

// Detectar tecla Enter para enviar mensaje
document.getElementById("input").addEventListener("keydown", function(event) {
    if (event.key === "Enter") sendMessage();
});

// Vincular el botón de enviar
document.getElementById("sendBtn").addEventListener("click", sendMessage);
