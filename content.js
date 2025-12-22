console.log("%c BIBLIOTECA UNIVERSAL: OPTIMIZADA ", "background: #000; color: #00ff00; font-size: 14px");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "injectPrompt") {
    injectText(request.text);
    sendResponse({ status: "success" });
  }
  return true;
});

function injectText(text) {
  // 1. ESTRATEGIA DE BÚSQUEDA INTELIGENTE
  let inputElement = 
    document.querySelector('#prompt-textarea') || // ChatGPT
    document.querySelector('div[contenteditable="true"]') || // Claude, Gemini
    document.querySelector('textarea') || // Perplexity, etc
    document.querySelector('input[type="text"]');

  if (!inputElement) {
    alert("No he podido detectar automáticamente la caja de chat en esta web.");
    return;
  }

  // Efecto visual (flash amarillo)
  const originalBackground = inputElement.style.backgroundColor;
  inputElement.style.transition = "background-color 0.2s";
  inputElement.style.backgroundColor = "#fff9c4";
  setTimeout(() => { inputElement.style.backgroundColor = originalBackground; }, 300);

  inputElement.focus();

  // 2. LÓGICA DE INYECCIÓN SEGÚN EL TIPO DE ELEMENTO
  
  // CASO A: Es un TEXTAREA (ChatGPT, Perplexity, HuggingChat)
  // Usamos el "Hack de Setter Nativo" para velocidad instantánea
  if (inputElement.tagName === 'TEXTAREA') {
    try {
      // Obtenemos el "setter" original del prototipo de HTMLTextAreaElement
      // Esto engaña a React para que acepte el cambio de valor inmediatamente
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      nativeInputValueSetter.call(inputElement, text);
      
      // Disparamos el evento para que la web sepa que ha cambiado
      const event = new Event('input', { bubbles: true });
      inputElement.dispatchEvent(event);
      
    } catch (e) {
      // Fallback si falla el hack
      console.warn("Fallo inyección directa, usando método lento...");
      document.execCommand('insertText', false, text);
    }
  } 
  
  // CASO B: Es un DIV EDITABLE (Claude, Gemini)
  // Aquí execCommand suele funcionar bien, pero si es muy largo, innerText es más rápido
  else {
    // Si el texto es enorme (>2000 caracteres), forzamos innerText para velocidad
    if (text.length > 2000) {
      inputElement.innerText = text; 
    } else {
      // Para textos normales preferimos insertText porque respeta mejor el historial (Ctrl+Z)
      const success = document.execCommand('insertText', false, text);
      if (!success) inputElement.innerText = text;
    }
    
    // Disparar eventos para despertar el botón de "Enviar"
    inputElement.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // 3. ASEGURAR QUE EL BOTÓN DE ENVIAR SE ACTIVE
  // A veces las webs modernas necesitan un extra de eventos
  setTimeout(() => {
    inputElement.dispatchEvent(new Event('change', { bubbles: true }));
  }, 100);
}