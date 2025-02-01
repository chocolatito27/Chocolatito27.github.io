async function sendMessage() {
    let userInput = document.getElementById("user-input").value;
    if (userInput.trim() === "") return;

    let chatBox = document.getElementById("chat-box");

    // Mostrar mensaje del usuario
    let userMessage = document.createElement("p");
    userMessage.classList.add("user-message");
    userMessage.textContent = userInput;
    chatBox.appendChild(userMessage);

    document.getElementById("user-input").value = "";

    // Mostrar mensaje de "espera" mientras la IA procesa
    let botMessage = document.createElement("p");
    botMessage.classList.add("bot-message");
    botMessage.textContent = "Pensando...";
    chatBox.appendChild(botMessage);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Enviar el mensaje al servidor de OpenAI
    const response = await getOpenAIResponse(userInput);
    // Actualizar la respuesta de la IA
    botMessage.textContent = response;
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Función para obtener la respuesta de OpenAI
async function getOpenAIResponse(userInput) {
    const apiKey = "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"; // Reemplaza con tu clave API
    const endpoint = "https://api.openai.com/v1/completions";
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
    };

    const body = JSON.stringify({
        model: "text-davinci-003", // Puedes cambiar el modelo a "gpt-3.5-turbo" o "gpt-4" si lo prefieres
        prompt: userInput,
        max_tokens: 150,  // Puedes ajustar la longitud de la respuesta aquí
    });

    const options = {
        method: "POST",
        headers: headers,
        body: body,
    };

    try {
        const res = await fetch(endpoint, options);
        const data = await res.json();
        return data.choices[0].text.trim();
    } catch (error) {
        console.error("Error:", error);
        return "Lo siento, algo salió mal al contactar a la IA.";
    }
}
