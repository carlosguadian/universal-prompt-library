console.log("%c BIBLIOTECA UNIVERSAL: LISTA ", "background: #000; color: #00ff00; font-size: 14px");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "injectPrompt") {
    injectText(request.text);
    sendResponse({ status: "success" });
  }
  return true;
});

function injectText(text) {
  // ESTRATEGIA DE BÚSQUEDA INTELIGENTE
  // Buscamos el elemento de entrada en orden de probabilidad
  
  let inputElement = 
    // 1. ChatGPT específico
    document.querySelector('#prompt-textarea') ||
    // 2. Elementos ricos de texto (Claude, Gemini, Facebook, etc.)
    document.querySelector('div[contenteditable="true"]') ||
    // 3. Textareas estándar visibles (Perplexity, HuggingFace, etc.)
    document.querySelector('textarea') ||
    // 4. Último recurso: cualquier input de texto (Buscadores)
    document.querySelector('input[type="text"]');

  if (!inputElement) {
    alert("No he podido detectar automáticamente la caja de chat en esta web.");
    return;
  }

  // Efecto visual para que sepas qué caja ha detectado (parpadeo amarillo)
  const originalBackground = inputElement.style.backgroundColor;
  inputElement.style.transition = "background-color 0.3s";
  inputElement.style.backgroundColor = "#fff9c4"; // Amarillo suave
  setTimeout(() => { inputElement.style.backgroundColor = originalBackground; }, 500);

  // INYECCIÓN ROBUSTA
  inputElement.focus();

  // Intento 1: execCommand (Simula escritura humana - Mejor compatibilidad)
  const success = document.execCommand('insertText', false, text);

  // Intento 2: Manipulación directa (Si execCommand falla)
  if (!success) {
    // Si es un div editable (Claude/Gemini)
    if (inputElement.contentEditable === "true") {
      inputElement.innerText = text; 
    } else {
      // Si es un input/textarea normal
      const start = inputElement.selectionStart;
      const end = inputElement.selectionEnd;
      const val = inputElement.value;
      inputElement.value = val.slice(0, start) + text + val.slice(end);
      inputElement.selectionStart = inputElement.selectionEnd = start + text.length;
    }
  }

  // DISPARAR EVENTOS (Crucial para React/Angular/Vue)
  // Esto le dice a la IA: "¡Eh, alguien ha escrito aquí!" para habilitar el botón de enviar
  const events = ['input', 'change', 'keydown', 'keypress', 'keyup'];
  events.forEach(evtType => {
    inputElement.dispatchEvent(new Event(evtType, { bubbles: true }));
  });
}