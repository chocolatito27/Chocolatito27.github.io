function sendMessage() {
    let userInput = document.getElementById("user-input").value;
    if (userInput.trim() === "") return;

    let chatBox = document.getElementById("chat-box");

    // Mostrar mensaje del usuario
    let userMessage = document.createElement("p");
    userMessage.classList.add("user-message");
    userMessage.textContent = userInput;
    chatBox.appendChild(userMessage);

    document.getElementById("user-input").value = "";

    // Simular respuesta de la IA (puedes cambiarlo por una API real)
    setTimeout(() => {
        let botMessage = document.createElement("p");
        botMessage.classList.add("bot-message");
        botMessage.textContent = "Lo siento, aún estoy aprendiendo. Pronto seré más inteligente.";
        chatBox.appendChild(botMessage);
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 1000);
}
