// sidepanel.js - Versión con Historial de Variables y Valores por Defecto

let treeData = []; 
let dragSrcId = null; 
let editingId = null; 
let variableHistory = {}; // Nuevo: Almacén para el historial

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

// --- GESTIÓN DE VARIABLES Y PROMPTS (MEJORADA) ---

async function handleInject(node) {
  let content = node.content;
  
  // Regex capturar {{Variable}} o {{Variable|Default}}
  const regex = /{{(.*?)}}/g; 
  const matches = [...content.matchAll(regex)];
  
  // Mapa para unicidad y guardar defaults
  const uniqueVarsMap = new Map();

  matches.forEach(match => {
    const rawContent = match[1]; 
    const [name, defaultValue] = rawContent.split('|').map(s => s.trim());
    
    if (!uniqueVarsMap.has(name)) {
      uniqueVarsMap.set(name, defaultValue || ""); 
    }
  });

  if (uniqueVarsMap.size > 0) {
    for (const [varName, defaultVal] of uniqueVarsMap) {
      // Pedimos valor (pasando el default)
      const value = await askUserForValue(varName, defaultVal);
      
      if (value === null) return; // Usuario canceló

      // Guardar historial
      saveToHistory(varName, value);

      // Reemplazar globalmente manejando ambas sintaxis
      const replaceRegex = new RegExp(`{{${varName}(\\|.*?)?}}`, 'g');
      content = content.replace(replaceRegex, value);
    }
  }

  // Guardar historial persistente
  chrome.storage.local.set({ varHistory: variableHistory });

  // Inyección
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

function askUserForValue(varName, defaultValue) {
  return new Promise((resolve) => {
    // Usamos el modal existente o creamos uno
    let modal = document.getElementById('varModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'varModal';
      document.body.appendChild(modal);
    }

    // Función interna para renderizar los chips dinámicamente
    // Esto nos permite refrescar la lista al borrar sin cerrar el modal
    const renderChips = () => {
      const historyOptions = variableHistory[varName] || [];
      const container = document.getElementById('chipsContainer');
      
      if (!container) return; // Seguridad

      if (historyOptions.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
      }

      container.style.display = 'flex';
      container.innerHTML = `
        <span style="font-size:11px; color:#999; width:100%; margin-bottom:2px;">Historial reciente:</span>
        ${historyOptions.map((opt, index) => {
          const shortText = opt.length > 30 ? opt.substring(0, 30) + '...' : opt;
          const safeValue = opt.replace(/"/g, '&quot;'); 
          
          // Estructura: Texto + Botón X
          return `
            <div class="history-chip" title="${safeValue}">
              <span class="text" data-value="${safeValue}">${shortText}</span>
              <span class="chip-delete" data-index="${index}">×</span>
            </div>`;
        }).join('')}
      `;

      // Re-asignar eventos a los nuevos elementos
      
      // 1. Evento Clic en el TEXTO (Rellenar)
      container.querySelectorAll('.text').forEach(span => {
        span.onclick = (e) => {
          e.stopPropagation(); // Evitar conflictos
          const input = document.getElementById('dynamicVarInput');
          input.value = span.getAttribute('data-value');
          input.focus();
          // Efecto visual flash
          input.style.backgroundColor = '#f0fff4';
          setTimeout(() => input.style.backgroundColor = 'white', 300);
        };
      });

      // 2. Evento Clic en la X (Borrar)
      container.querySelectorAll('.chip-delete').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation(); // IMPORTANTE: Que no active el rellenado
          const idx = parseInt(btn.getAttribute('data-index'));
          
          // Borrar del array en memoria
          variableHistory[varName].splice(idx, 1);
          
          // Guardar cambios en Chrome Storage
          chrome.storage.local.set({ varHistory: variableHistory });
          
          // Volver a pintar la lista
          renderChips();
        };
      });
    };

    // Estructura HTML inicial del Modal
    modal.innerHTML = `
      <div class="modal-content" style="background:white; padding:20px; border-radius:8px; width:90%; max-width:500px; box-shadow:0 4px 15px rgba(0,0,0,0.2); display:flex; flex-direction:column;">
        <h3 style="margin-top:0">Variable: <span style="color:#10a37f; background:#e0f2f1; padding:2px 6px; border-radius:4px;">${varName}</span></h3>
        <p style="margin-bottom:10px; color:#666; font-size:13px;">Introduce o pega el contenido para esta variable:</p>
        
        <div id="chipsContainer" class="history-container"></div>

        <textarea id="dynamicVarInput" 
                  placeholder="${defaultValue ? 'Por defecto: ' + defaultValue : 'Escribe o pega aquí tu texto...'}"
                  spellcheck="false">${defaultValue || ''}</textarea>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button id="dynamicCancelBtn" style="padding:8px 16px; border:none; border-radius:4px; cursor:pointer; background:#eee;">Cancelar</button>
          <button id="dynamicConfirmBtn" style="padding:8px 16px; border:none; border-radius:4px; cursor:pointer; background:#10a37f; color:white;">Insertar</button>
        </div>
        <div style="font-size:10px; color:#aaa; margin-top:5px; text-align:right;">Ctrl + Enter para insertar</div>
      </div>
    `;

    // Estilos del modal
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
    
    // Inicializar lógica
    const input = document.getElementById('dynamicVarInput');
    const confirmBtn = document.getElementById('dynamicConfirmBtn');
    const cancelBtn = document.getElementById('dynamicCancelBtn');

    // Pintar los chips por primera vez
    renderChips();

    // Focus inicial
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
      resolve(val);
    };

    const cancel = () => {
      modal.style.display = 'none';
      resolve(null);
    };

    confirmBtn.onclick = submit;
    cancelBtn.onclick = cancel;
    
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
      id: Date.now().toString(),
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
  // Cargamos árbol y ahora también el historial
  const result = await chrome.storage.local.get(['promptTree', 'varHistory']);
  treeData = result.promptTree || [];
  variableHistory = result.varHistory || {};
}

function saveData() { chrome.storage.local.set({ promptTree: treeData }); }
function copyToClipboard(text) { navigator.clipboard.writeText(text); }

function setupEventListeners() {
  document.getElementById('addFolderBtn').onclick = () => addNewItem('folder');
  document.getElementById('addPromptBtn').onclick = () => addNewItem('prompt');
  document.getElementById('searchInput').addEventListener('input', (e) => renderTree(e.target.value));
  document.getElementById('exportBtn').onclick = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(treeData));
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
      try { treeData = JSON.parse(event.target.result); saveData(); renderTree(); alert('Biblioteca restaurada'); } 
      catch(err) { alert('Error al leer el archivo'); }
    };
    reader.readAsText(file);
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