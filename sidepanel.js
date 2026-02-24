// sidepanel.js - Versión con Historial de Variables y Valores por Defecto

let treeData = []; 
let dragSrcId = null; 
let editingId = null; 
let variableHistory = {}; //Almacén para el historial
let lastModifiedTimestamp = null; // Marca de tiempo

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  loadDarkMode();
  renderTree();
  setupEventListeners();
});

// --- DARK MODE ---
function loadDarkMode() {
  chrome.storage.local.get('darkMode', (result) => {
    if (result.darkMode) {
      document.body.classList.add('dark-mode');
      updateDarkModeIcon(true);
    }
  });
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  chrome.storage.local.set({ darkMode: isDark });
  updateDarkModeIcon(isDark);
}

function updateDarkModeIcon(isDark) {
  const btn = document.getElementById('darkModeBtn');
  if (btn) {
    btn.querySelector('.material-icons').innerText = isDark ? 'light_mode' : 'dark_mode';
    btn.title = isDark ? 'Modo claro' : 'Modo oscuro';
  }
}

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
      actions.appendChild(createActionBtn('content_copy', () => {
        copyToClipboard(node.content);
        node.useCount = (node.useCount || 0) + 1;
        node.lastUsed = Date.now();
        saveData();
      }));
    }
    // Botón de favorito (estrella)
    const favBtn = createActionBtn(
      node.isFavorite ? 'star' : 'star_border',
      () => toggleFavorite(node.id)
    );
    if (node.isFavorite) favBtn.classList.add('favorite-active');
    actions.appendChild(favBtn);
    actions.appendChild(createActionBtn('file_copy', () => duplicateNode(node.id)));
    actions.appendChild(createActionBtn('edit', () => openModal(node.type, node.id)));
    actions.appendChild(createActionBtn('delete', () => deleteNode(node.id)));

    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    spacer.innerText = " "; 

    // Montar header: icono, título, [estrella favorito], [badge uso], spacer, acciones
    const headerElements = [icon, title];

    if (node.isFavorite) {
      const favIcon = document.createElement('span');
      favIcon.className = 'material-icons favorite-indicator';
      favIcon.innerText = 'star';
      headerElements.push(favIcon);
    }

    if (node.type === 'prompt' && node.useCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'use-count-badge';
      badge.title = `Usado ${node.useCount} ${node.useCount === 1 ? 'vez' : 'veces'}${node.lastUsed ? ' · Último: ' + new Date(node.lastUsed).toLocaleDateString('es-ES') : ''}`;
      badge.textContent = node.useCount;
      headerElements.push(badge);
    }

    headerElements.push(spacer, actions);
    header.append(...headerElements);
    div.appendChild(header);

    // Preview de contenido para prompts
    if (node.type === 'prompt' && node.content) {
      const preview = document.createElement('div');
      preview.className = 'prompt-preview';
      preview.textContent = node.content.length > 200 ? node.content.substring(0, 200) + '…' : node.content;
      div.appendChild(preview);

      header.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          preview.classList.toggle('open');
        }
      });
    }

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
          // Actualización parcial: solo toggle del contenedor hijo + icono
          childrenContainer.classList.toggle('open', node.isOpen);
          icon.innerText = node.isOpen ? 'folder_open' : 'folder';
          saveData();
        }
      });
    }
    
    setupDragEvents(header, node);
    return div;
  }

  // Ordenar: favoritos primero (manteniendo orden relativo)
  const sortedData = [...treeData].sort((a, b) => (b.isFavorite ? 1 : 0) - (a.isFavorite ? 1 : 0));
  sortedData.forEach(node => {
    const el = createNodeElement(node);
    if(el) container.appendChild(el);
  });
}

function createActionBtn(iconName, onClick) {
  const btn = document.createElement('button');
  btn.innerHTML = `<span class="material-icons" style="font-size:16px">${iconName}</span>`;
  btn.onmousedown = (e) => e.stopPropagation();
  btn.onclick = (e) => {
    e.stopPropagation();
    try {
      const result = onClick();
      // Si es una Promise (función async), atrapar errores
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          console.error('Error en acción:', err);
          alert('Error: ' + err.message);
        });
      }
    } catch (err) {
      console.error('Error en acción:', err);
      alert('Error: ' + err.message);
    }
  };
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
  try {
    let content = node.content;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      alert('Este prompt no tiene contenido. Edítalo para añadir texto.');
      return;
    }

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

  // Tracking de uso
  node.useCount = (node.useCount || 0) + 1;
  node.lastUsed = Date.now();
  saveData();

  // Inyección final
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "injectPrompt", text: content })
      .catch(error => {
        console.error("Error sendMessage:", error);
        alert("Error: Recarga la página (F5) para reconectar la extensión.");
      });
  } else {
    alert('Error: No se encontró la pestaña activa.');
  }
  } catch (err) {
    console.error('Error en handleInject:', err);
    alert('Error inesperado: ' + err.message);
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

// --- MODAL DE VARIABLES (Estructura fija en HTML, solo se actualizan valores) ---

function renderChips(varName) {
  const historyOptions = variableHistory[varName] || [];
  const container = document.getElementById('chipsContainer');
  if (!container) return;

  container.innerHTML = '';

  if (historyOptions.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  const label = document.createElement('span');
  label.className = 'history-label';
  label.textContent = 'Historial reciente:';
  container.appendChild(label);

  historyOptions.forEach((opt, index) => {
    const shortText = opt.length > 30 ? opt.substring(0, 30) + '...' : opt;

    const chip = document.createElement('div');
    chip.className = 'history-chip';
    chip.title = opt;

    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = shortText;
    textSpan.onclick = (e) => {
      e.stopPropagation();
      const input = document.getElementById('dynamicVarInput');
      input.value = opt;
      input.focus();
      input.style.backgroundColor = document.body.classList.contains('dark-mode') ? '#0a3d2e' : '#f0fff4';
      setTimeout(() => input.style.backgroundColor = '', 300);
    };

    const deleteBtn = document.createElement('span');
    deleteBtn.className = 'chip-delete';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      variableHistory[varName].splice(index, 1);
      chrome.storage.local.set({ varHistory: variableHistory });
      renderChips(varName);
    };

    chip.append(textSpan, deleteBtn);
    container.appendChild(chip);
  });
}

function askUserForValue(varName, defaultValue, currentIndex, totalVars) {
  return new Promise((resolve) => {
    const modal = document.getElementById('varModal');
    const isLastStep = currentIndex === totalVars - 1;

    // Actualizar contenido dinámico (sin recrear estructura)
    document.getElementById('varNameTitle').textContent = varName;
    document.getElementById('varStepIndicator').textContent = `Paso ${currentIndex + 1} de ${totalVars}`;

    const input = document.getElementById('dynamicVarInput');
    input.value = defaultValue || '';
    input.placeholder = defaultValue ? 'Por defecto: ' + defaultValue : 'Escribe o pega aquí tu texto...';
    input.style.borderColor = '';

    const confirmBtn = document.getElementById('dynamicConfirmBtn');
    confirmBtn.textContent = isLastStep ? 'Insertar' : 'Siguiente';

    const backBtn = document.getElementById('dynamicBackBtn');
    backBtn.classList.toggle('hidden', currentIndex === 0);

    document.getElementById('varHintAction').textContent = isLastStep ? 'insertar' : 'avanzar';

    renderChips(varName);

    // Mostrar modal
    modal.classList.remove('hidden');
    input.focus();
    if (input.value) input.select();

    // Handlers (reasignar para limpiar referencias anteriores)
    const submit = () => {
      let val = input.value.trim();
      if (val === '' && defaultValue) val = defaultValue;
      if (!val && !defaultValue) {
        input.style.borderColor = 'red';
        return;
      }
      modal.classList.add('hidden');
      cleanup();
      resolve({ action: 'next', value: val });
    };

    const cancel = () => {
      modal.classList.add('hidden');
      cleanup();
      resolve({ action: 'cancel' });
    };

    const goBack = () => {
      modal.classList.add('hidden');
      cleanup();
      resolve({ action: 'back' });
    };

    const onKeydown = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
      if (e.key === 'Escape') cancel();
    };

    const cleanup = () => {
      confirmBtn.onclick = null;
      document.getElementById('dynamicCancelBtn').onclick = null;
      backBtn.onclick = null;
      input.onkeydown = null;
    };

    confirmBtn.onclick = submit;
    document.getElementById('dynamicCancelBtn').onclick = cancel;
    backBtn.onclick = goBack;
    input.onkeydown = onKeydown;
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

function toggleFavorite(id) {
  const node = findNode(treeData, id);
  if (!node) return;
  node.isFavorite = !node.isFavorite;
  saveData();
  renderTree();
  showToast(node.isFavorite ? '⭐ Añadido a favoritos' : 'Eliminado de favoritos');
}

function duplicateNode(id) {
  const original = findNode(treeData, id);
  if (!original) return;

  const deepClone = (node, isRoot) => {
    const clone = {
      id: crypto.randomUUID(),
      type: node.type,
      title: isRoot ? node.title + ' (copia)' : node.title,
      content: node.content || null,
      children: node.children ? node.children.map(c => deepClone(c, false)) : null,
      isOpen: node.isOpen || false
    };
    // No copiar useCount/lastUsed (se resetean), pero sí isFavorite
    if (node.isFavorite) clone.isFavorite = true;
    return clone;
  };

  const clone = deepClone(original, true);

  // Insertar justo después del original en el mismo nivel
  const parentNode = findParent(treeData, id);
  const siblings = parentNode ? parentNode.children : treeData;
  const idx = siblings.findIndex(n => n.id === id);
  siblings.splice(idx + 1, 0, clone);

  saveData();
  renderTree();
  showToast('✓ Duplicado');
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
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 1500);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('✓ Copiado');
  }).catch(() => {
    alert('No se pudo copiar al portapapeles.');
  });
}

function setupEventListeners() {
  document.getElementById('addFolderBtn').onclick = () => addNewItem('folder');
  document.getElementById('addPromptBtn').onclick = () => addNewItem('prompt');
  document.getElementById('searchInput').addEventListener('input', (e) => renderTree(e.target.value));
  document.getElementById('darkModeBtn').onclick = toggleDarkMode;
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