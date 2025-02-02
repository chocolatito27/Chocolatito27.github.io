<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat IA Local</title>
    <script src="https://cdn.jsdelivr.net/npm/@xenova/transformers"></script>
    <style>
        body { font-family: Arial, sans-serif; }
        #chat { width: 300px; height: 400px; overflow-y: scroll; border: 1px solid #ccc; padding: 10px; }
        #input { width: 300px; }
    </style>
</head>
<body>
    <h2>Chat IA</h2>
    <div id="chat"></div>
    <input type="text" id="input" placeholder="Escribe algo..." onkeydown="if(event.key==='Enter') sendMessage()">
    <button onclick="sendMessage()">Enviar</button>

    <script>
        let model;
        async function loadModel() {
            model = await transformers.pipeline('text-generation', 'Xenova/distilgpt2');
            console.log("Modelo cargado.");
        }
        loadModel();

        async function sendMessage() {
            let input = document.getElementById("input");
            let chat = document.getElementById("chat");
            let userMessage = input.value;
            input.value = "";

            chat.innerHTML += "<p><b>Tú:</b> " + userMessage + "</p>";

            if (!model) {
                chat.innerHTML += "<p><b>Bot:</b> Cargando modelo, espera un momento...</p>";
                return;
            }

            let response = await model(userMessage, { max_length: 50 });
            let botMessage = response[0].generated_text;

            chat.innerHTML += "<p><b>Bot:</b> " + botMessage + "</p>";
            chat.scrollTop = chat.scrollHeight;
        }
    </script>
</body>
</html>