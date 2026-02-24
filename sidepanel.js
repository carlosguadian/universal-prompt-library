// sidepanel.js - Versión con Historial de Variables y Valores por Defecto

let treeData = []; 
let dragSrcId = null; 
let editingId = null; 
let variableHistory = {}; //Almacén para el historial
let lastModifiedTimestamp = null; // Marca de tiempo

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderTree();
  setupEventListeners();
});

// --- RENDERIZADO ---
function renderTree(filterText = '') {
  const container = document.getElementById('libraryContainer');
  container.innerHTML = '';
  
  function createNodeElement(node) {
    const matchesFilter = node.title.toLowerCase().includes(filterText.toLowerCase()) || 
                          (node.content && node.content.toLowerCase().includes(filterText.toLowerCase()));
    
    if (filterText && !matchesFilter && node.type === 'prompt') return null;

    // Contenedor principal
    const div = document.createElement('div');
    div.className = 'node';
    div.dataset.id = node.id;

    // ENCABEZADO: ELEMENTO ARRASTRABLE
    const header = document.createElement('div');
    header.className = `node-header ${node.type}`;
    header.setAttribute('draggable', 'true'); 
    
    const icon = document.createElement('span');
    icon.className = 'material-icons icon';
    icon.innerText = node.type === 'folder' ? (node.isOpen ? 'folder_open' : 'folder') : 'chat_bubble_outline';
    
    const title = document.createElement('span');
    title.innerText = node.title;
    
    const actions = document.createElement('div');
    actions.className = 'node-actions';
    
    if (node.type === 'prompt') {
      actions.appendChild(createActionBtn('send', () => handleInject(node)));
      actions.appendChild(createActionBtn('content_copy', () => copyToClipboard(node.content)));
    }
    actions.appendChild(createActionBtn('edit', () => openModal(node.type, node.id)));
    actions.appendChild(createActionBtn('delete', () => deleteNode(node.id)));

    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    spacer.innerText = " "; 

    header.append(icon, title, spacer, actions);
    div.appendChild(header);

    if (node.type === 'folder') {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = `node-content ${node.isOpen || filterText ? 'open' : ''}`;
      
      if (node.children) {
        node.children.forEach(child => {
          const childEl = createNodeElement(child);
          if (childEl) childrenContainer.appendChild(childEl);
        });
      }
      div.appendChild(childrenContainer);

      header.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !header.classList.contains('dragging')) {
          node.isOpen = !node.isOpen;
          saveData();
          renderTree(filterText);
        }
      });
    }
    
    setupDragEvents(header, node);
    return div;
  }

  treeData.forEach(node => {
    const el = createNodeElement(node);
    if(el) container.appendChild(el);
  });
}

function createActionBtn(iconName, onClick) {
  const btn = document.createElement('button');
  btn.innerHTML = `<span class="material-icons" style="font-size:16px">${iconName}</span>`;
  btn.onmousedown = (e) => e.stopPropagation(); 
  btn.onclick = (e) => { e.stopPropagation(); onClick(); };
  return btn;
}

// --- DRAG AND DROP ---

function setupDragEvents(element, node) {
  element.addEventListener('dragstart', (e) => {
    dragSrcId = node.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id); 
    element.classList.add('dragging');
    setTimeout(() => element.classList.add('ghost'), 0);
  });

  element.addEventListener('dragend', (e) => {
    element.classList.remove('dragging', 'ghost');
    clearAllDragClasses();
  });

  element.addEventListener('dragover', (e) => {
    e.preventDefault(); 
    if (dragSrcId === node.id) return;

    const rect = element.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    element.classList.remove('drag-top', 'drag-bottom', 'drag-inside');

    if (node.type === 'folder') {
      if (offsetY < height * 0.25) element.classList.add('drag-top');
      else if (offsetY > height * 0.75) element.classList.add('drag-bottom');
      else element.classList.add('drag-inside');
    } else {
      if (offsetY < height * 0.5) element.classList.add('drag-top');
      else element.classList.add('drag-bottom');
    }
  });

  element.addEventListener('dragleave', (e) => {
    element.classList.remove('drag-top', 'drag-bottom', 'drag-inside');
  });

  element.addEventListener('drop', (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (dragSrcId === node.id) return;

    let position = '';
    if (element.classList.contains('drag-top')) position = 'before';
    else if (element.classList.contains('drag-bottom')) position = 'after';
    else if (element.classList.contains('drag-inside')) position = 'inside';

    clearAllDragClasses();

    if (position) {
      moveNode(dragSrcId, node.id, position);
    }
  });
}

function clearAllDragClasses() {
  document.querySelectorAll('.drag-top, .drag-bottom, .drag-inside').forEach(el => {
    el.classList.remove('drag-top', 'drag-bottom', 'drag-inside');
  });
}

function moveNode(srcId, targetId, position) {
  let nodeToMove = null;
  
  const remove = (nodes) => {
    const idx = nodes.findIndex(n => n.id === srcId);
    if (idx > -1) {
      nodeToMove = nodes[idx];
      nodes.splice(idx, 1);
      return true;
    }
    for (const node of nodes) {
      if (node.children && remove(node.children)) return true;
    }
    return false;
  };
  remove(treeData);

  if (!nodeToMove) return;

  if (position === 'inside') {
    const targetNode = findNode(treeData, targetId);
    if (targetNode && targetNode.children) {
      targetNode.children.push(nodeToMove);
      targetNode.isOpen = true; 
    }
  } else {
    const parentInfo = findParent(treeData, targetId);
    const siblings = parentInfo ? parentInfo.children : treeData;
    
    const targetIndex = siblings.findIndex(n => n.id === targetId);
    if (targetIndex > -1) {
      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
      siblings.splice(insertIndex, 0, nodeToMove);
    }
  }

  saveData();
  renderTree();
}

function findParent(nodes, childId) {
  for (const node of nodes) {
    if (node.children) {
      if (node.children.some(ch => ch.id === childId)) return node;
      const found = findParent(node.children, childId);
      if (found) return found;
    }
  }
  return null;
}

// --- UTILIDADES ---
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- GESTIÓN DE VARIABLES Y PROMPTS (MEJORADA) ---

async function handleInject(node) {
  let content = node.content;
  
  // Regex para capturar {{Variable}} o {{Variable|Default}}
  const regex = /{{(.*?)}}/g; 
  const matches = [...content.matchAll(regex)];
  
  // Mapa para unicidad
  const uniqueVarsMap = new Map();
  matches.forEach(match => {
    const rawContent = match[1]; 
    const [name, defaultValue] = rawContent.split('|').map(s => s.trim());
    if (!uniqueVarsMap.has(name)) {
      uniqueVarsMap.set(name, defaultValue || ""); 
    }
  });

  // Convertimos el mapa a un Array para poder navegar hacia adelante y atrás
  const varsArray = Array.from(uniqueVarsMap.entries());
  // Objeto para guardar temporalmente las respuestas del usuario
  const userAnswers = {};

  if (varsArray.length > 0) {
    let i = 0;
    while (i < varsArray.length) {
      const [varName, defaultVal] = varsArray[i];
      
      // Si estamos volviendo atrás, mostramos lo que el usuario ya había escrito.
      // Si es la primera vez, mostramos el valor por defecto.
      const currentVal = userAnswers[varName] !== undefined ? userAnswers[varName] : defaultVal;

      // Pedimos el valor (pasamos también el índice para saber si mostramos el botón "Atrás")
      const result = await askUserForValue(varName, currentVal, i, varsArray.length);
      
      if (result.action === 'cancel') {
        return; // Usuario canceló todo el proceso
      } else if (result.action === 'back') {
        i--; // Retrocedemos una variable
      } else if (result.action === 'next') {
        // Guardamos la respuesta, el historial, y avanzamos
        userAnswers[varName] = result.value;
        saveToHistory(varName, result.value);
        i++; 
      }
    }

    // Una vez completadas TODAS las variables, hacemos el reemplazo en el texto
    for (const [varName, value] of Object.entries(userAnswers)) {
      const replaceRegex = new RegExp(`{{${escapeRegex(varName)}(\\|.*?)?}}`, 'g');
      content = content.replace(replaceRegex, value);
    }
    
    // Guardamos el historial persistente en Chrome
    chrome.storage.local.set({ varHistory: variableHistory });
  }

  // Inyección final
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "injectPrompt", text: content })
      .catch(error => {
        console.error("Error:", error);
        alert("Error: Recarga la página (F5) para reconectar la extensión.");
      });
  }
}

// Función auxiliar para gestionar historial
function saveToHistory(varName, value) {
  if (!variableHistory[varName]) {
    variableHistory[varName] = [];
  }
  // Evitar duplicados y poner al principio
  variableHistory[varName] = variableHistory[varName].filter(v => v !== value);
  variableHistory[varName].unshift(value);
  // Limite de 5 items
  if (variableHistory[varName].length > 5) {
    variableHistory[varName] = variableHistory[varName].slice(0, 5);
  }
}

// Modal Dinámico con Datalist

function askUserForValue(varName, defaultValue, currentIndex, totalVars) {
  return new Promise((resolve) => {
    let modal = document.getElementById('varModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'varModal';
      document.body.appendChild(modal);
    }

    const renderChips = () => {
      const historyOptions = variableHistory[varName] || [];
      const container = document.getElementById('chipsContainer');
      if (!container) return;

      // Limpiar contenido anterior de forma segura
      container.innerHTML = '';

      if (historyOptions.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'flex';

      // Label de "Historial reciente"
      const label = document.createElement('span');
      label.style.cssText = 'font-size:11px; color:#999; width:100%; margin-bottom:2px;';
      label.textContent = 'Historial reciente:';
      container.appendChild(label);

      // Crear chips de forma segura (sin innerHTML)
      historyOptions.forEach((opt, index) => {
        const shortText = opt.length > 30 ? opt.substring(0, 30) + '...' : opt;

        const chip = document.createElement('div');
        chip.className = 'history-chip';
        chip.title = opt; // title se asigna como texto, no HTML

        const textSpan = document.createElement('span');
        textSpan.className = 'text';
        textSpan.textContent = shortText; // textContent es seguro contra XSS
        textSpan.onclick = (e) => {
          e.stopPropagation();
          const input = document.getElementById('dynamicVarInput');
          input.value = opt; // Usamos el valor original directamente
          input.focus();
          input.style.backgroundColor = '#f0fff4';
          setTimeout(() => input.style.backgroundColor = 'white', 300);
        };

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'chip-delete';
        deleteBtn.textContent = '×';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          variableHistory[varName].splice(index, 1);
          chrome.storage.local.set({ varHistory: variableHistory });
          renderChips();
        };

        chip.append(textSpan, deleteBtn);
        container.appendChild(chip);
      });
    };

    // Textos dinámicos para los botones según el paso
    const isLastStep = currentIndex === totalVars - 1;
    const confirmText = isLastStep ? 'Insertar' : 'Siguiente';
    const backBtnHTML = currentIndex > 0 
      ? `<button id="dynamicBackBtn" style="padding:8px 16px; border:1px solid #ccc; border-radius:4px; cursor:pointer; background:white; color:#333;">← Atrás</button>` 
      : `<div></div>`; // Div vacío para mantener el espaciado flex

    modal.innerHTML = `
      <div class="modal-content" style="background:white; padding:20px; border-radius:8px; width:90%; max-width:500px; box-shadow:0 4px 15px rgba(0,0,0,0.2); display:flex; flex-direction:column;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0;">
          <h3 style="margin:0;">Variable: <span style="color:#10a37f; background:#e0f2f1; padding:2px 6px; border-radius:4px;">${varName}</span></h3>
          <span style="font-size:12px; color:#999; font-weight:bold;">Paso ${currentIndex + 1} de ${totalVars}</span>
        </div>
        
        <p style="margin:10px 0; color:#666; font-size:13px;">Introduce o pega el contenido para esta variable:</p>
        
        <div id="chipsContainer" class="history-container"></div>

        <textarea id="dynamicVarInput" 
                  placeholder="${defaultValue ? 'Por defecto: ' + defaultValue : 'Escribe o pega aquí tu texto...'}"
                  spellcheck="false">${defaultValue || ''}</textarea>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
          ${backBtnHTML}
          
          <div style="display:flex; gap:10px;">
            <button id="dynamicCancelBtn" style="padding:8px 16px; border:none; border-radius:4px; cursor:pointer; background:#eee;">Cancelar</button>
            <button id="dynamicConfirmBtn" style="padding:8px 16px; border:none; border-radius:4px; cursor:pointer; background:#10a37f; color:white;">${confirmText}</button>
          </div>
        </div>
        
        <div style="font-size:10px; color:#aaa; margin-top:8px; text-align:right;">Ctrl + Enter para ${isLastStep ? 'insertar' : 'avanzar'}</div>
      </div>
    `;

    modal.style.display = 'flex';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.5)';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';
    
    const input = document.getElementById('dynamicVarInput');
    const confirmBtn = document.getElementById('dynamicConfirmBtn');
    const cancelBtn = document.getElementById('dynamicCancelBtn');
    const backBtn = document.getElementById('dynamicBackBtn');

    renderChips();

    input.focus();
    if(input.value) input.select();

    const submit = () => {
      let val = input.value.trim();
      if (val === "" && defaultValue) val = defaultValue;
      
      if (!val && !defaultValue) {
        input.style.borderColor = "red";
        return;
      }
      modal.style.display = 'none';
      resolve({ action: 'next', value: val }); // Ahora devuelve un objeto de acción
    };

    const cancel = () => {
      modal.style.display = 'none';
      resolve({ action: 'cancel' });
    };

    const goBack = () => {
      modal.style.display = 'none';
      resolve({ action: 'back' });
    };

    confirmBtn.onclick = submit;
    cancelBtn.onclick = cancel;
    if (backBtn) backBtn.onclick = goBack;
    
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
      if (e.key === 'Escape') cancel();
    };
  });
}

// --- RESTO DE FUNCIONES ---

function addNewItem(type) { editingId = null; openModal(type); }

function saveItem(title, content, type) {
  if (editingId) {
    const node = findNode(treeData, editingId);
    if (node) {
      node.title = title;
      if (type === 'prompt') node.content = content;
    }
  } else {
    const newItem = {
      id: crypto.randomUUID(),
      type: type,
      title: title,
      content: type === 'prompt' ? content : null,
      children: type === 'folder' ? [] : null,
      isOpen: true
    };
    treeData.push(newItem);
  }
  saveData();
  renderTree();
}

function deleteNode(id) {
  if(confirm('¿Eliminar este elemento?')) {
    const remove = (nodes) => {
      const idx = nodes.findIndex(n => n.id === id);
      if (idx > -1) { nodes.splice(idx, 1); return true; }
      for (const node of nodes) { if (node.children && remove(node.children)) return true; }
      return false;
    };
    remove(treeData);
    saveData();
    renderTree();
  }
}

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

async function loadData() {
  // Ahora también pedimos lastModified
  const result = await chrome.storage.local.get(['promptTree', 'varHistory', 'lastModified']);
  treeData = result.promptTree || [];
  variableHistory = result.varHistory || {};
  lastModifiedTimestamp = result.lastModified || null;
  
  updateLastModifiedUI(); // Actualizamos el texto al cargar
}

function saveData() { 
  // Cada vez que guardamos, actualizamos la fecha al instante actual
  lastModifiedTimestamp = Date.now();
  
  chrome.storage.local.set({ 
    promptTree: treeData,
    varHistory: variableHistory, // Si lo tienes implementado
    lastModified: lastModifiedTimestamp // Guardamos la marca de tiempo
  });
  
  updateLastModifiedUI(); // Refrescamos el texto en pantalla
}
// NUEVA FUNCIÓN: Para formatear y mostrar la fecha
function updateLastModifiedUI() {
  const displayElement = document.getElementById('lastModified');
  if (!displayElement) return;

  if (!lastModifiedTimestamp) {
    displayElement.innerText = "Última actualización: Nunca";
    return;
  }

  // Formateamos la fecha al estilo local (ej: 20/2/2026, 16:24)
  const dateObj = new Date(lastModifiedTimestamp);
  const formattedDate = dateObj.toLocaleString('es-ES', { 
    day: '2-digit', month: '2-digit', year: 'numeric', 
    hour: '2-digit', minute: '2-digit' 
  });

  displayElement.innerText = `Última actualización: ${formattedDate}`;
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    // Feedback visual temporal
    const btn = document.querySelector('.node-actions button:nth-child(2)');
    const toast = document.createElement('div');
    toast.textContent = '✓ Copiado';
    toast.style.cssText = 'position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:#10a37f; color:white; padding:6px 16px; border-radius:4px; font-size:12px; z-index:9999; transition:opacity 0.3s;';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 1500);
  }).catch(() => {
    alert('No se pudo copiar al portapapeles.');
  });
}

function setupEventListeners() {
  document.getElementById('addFolderBtn').onclick = () => addNewItem('folder');
  document.getElementById('addPromptBtn').onclick = () => addNewItem('prompt');
  document.getElementById('searchInput').addEventListener('input', (e) => renderTree(e.target.value));
  document.getElementById('exportBtn').onclick = () => {
    const exportData = {
      prompts: treeData,
      variableHistory: variableHistory
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "prompts_backup.json");
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    dlAnchorElem.remove();
  };
  document.getElementById('importBtn').onclick = () => document.getElementById('fileInput').click();
  document.getElementById('fileInput').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);

        // Soportar formato nuevo { prompts, variableHistory } y formato legacy (array directo)
        let importedTree, importedHistory;
        if (Array.isArray(parsed)) {
          importedTree = parsed;
          importedHistory = null;
        } else if (parsed && Array.isArray(parsed.prompts)) {
          importedTree = parsed.prompts;
          importedHistory = parsed.variableHistory || null;
        } else {
          alert('Formato de archivo no válido. Se espera un array de prompts o un objeto con { prompts, variableHistory }.');
          return;
        }

        // Validar que cada nodo tiene la estructura mínima esperada
        const isValidNode = (node) => {
          return node && typeof node.id === 'string' && typeof node.title === 'string'
            && (node.type === 'prompt' || node.type === 'folder');
        };
        const validateTree = (nodes) => nodes.every(n => isValidNode(n) && (!n.children || validateTree(n.children)));

        if (!validateTree(importedTree)) {
          alert('El archivo contiene nodos con estructura incorrecta. Cada nodo necesita: id, title y type.');
          return;
        }

        treeData = importedTree;
        if (importedHistory && typeof importedHistory === 'object') {
          variableHistory = importedHistory;
        }
        saveData();
        renderTree();
        alert('Biblioteca restaurada');
      } catch(err) {
        alert('Error al leer el archivo: JSON no válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset para permitir reimportar el mismo archivo
  };
  
  // Modal de edición de items
  const modal = document.getElementById('modal');
  document.getElementById('saveBtn').onclick = () => {
    const title = document.getElementById('itemTitle').value;
    const content = document.getElementById('itemContent').value;
    if(!title) return alert('El título es obligatorio');
    const type = document.getElementById('itemContent').style.display === 'none' ? 'folder' : 'prompt';
    saveItem(title, content, type);
    modal.classList.add('hidden');
  };
  document.getElementById('cancelBtn').onclick = () => modal.classList.add('hidden');
}

function openModal(type, id = null) {
  const modal = document.getElementById('modal');
  const titleInput = document.getElementById('itemTitle');
  const contentInput = document.getElementById('itemContent');
  modal.classList.remove('hidden');
  contentInput.style.display = type === 'folder' ? 'none' : 'block';
  document.getElementById('modalTitle').innerText = id ? (type === 'folder' ? 'Editar Carpeta' : 'Editar Prompt') : (type === 'folder' ? 'Nueva Carpeta' : 'Nuevo Prompt');
  if (id) {
    const node = findNode(treeData, id);
    titleInput.value = node.title;
    contentInput.value = node.content || '';
    editingId = id;
  } else { titleInput.value = ''; contentInput.value = ''; editingId = null; }
  titleInput.focus();
}