async function sendMessage() {
    let userMessage = input.value.trim();
    if (userMessage === "") return;

    input.value = "";
    chat.innerHTML += `<p class='user'>🧑‍💻 Tú: ${userMessage}</p>`;
    chat.innerHTML += `<p class='loading'>⏳ Pensando...</p>`;

    try {
        let response = await fetch("https://v0-apis-a9-581mrooeb-chocolatito-s-projects.vercel.app", {  // Reemplaza con tu URL de Vercel
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage })
        });

        let data = await response.json();
        document.querySelector(".loading").remove();
        chat.innerHTML += `<p class='bot'>🤖 ${data.reply}</p>`;
    } catch (error) {
        chat.innerHTML += `<p class='error'>⚠️ Error: ${error.message}</p>`;
    }
}
