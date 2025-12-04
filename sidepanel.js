let treeData = []; 
let dragSrcId = null; 
let editingId = null; 

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

    // Contenedor principal (YA NO ES DRAGGABLE)
    const div = document.createElement('div');
    div.className = 'node';
    div.dataset.id = node.id;

    // ENCABEZADO: ESTE ES EL ELEMENTO ARRASTRABLE AHORA
    const header = document.createElement('div');
    header.className = `node-header ${node.type}`;
    header.setAttribute('draggable', 'true'); // <--- AQUI ESTA LA CLAVE
    
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

    // Usamos un spacer para asegurar que hay sitio donde agarrar
    const spacer = document.createElement('div');
    spacer.className = 'spacer';
    spacer.innerText = " "; // Caracter invisible para dar cuerpo

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

      // Evento de click para abrir carpeta (ignorando si es un drag)
      header.addEventListener('click', (e) => {
        if (!e.target.closest('button') && !header.classList.contains('dragging')) {
          node.isOpen = !node.isOpen;
          saveData();
          renderTree(filterText);
        }
      });
    }
    
    // Configurar eventos en el HEADER
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
  btn.onmousedown = (e) => e.stopPropagation(); // Evitar que el click del botón inicie drag
  btn.onclick = (e) => { e.stopPropagation(); onClick(); };
  return btn;
}

// --- DRAG AND DROP (APLICADO AL HEADER) ---

function setupDragEvents(element, node) {
  
  element.addEventListener('dragstart', (e) => {
    dragSrcId = node.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id); // Necesario para Firefox/algunos navegadores
    element.classList.add('dragging');
    // Timeout para que el navegador cree la imagen fantasma antes de ocultar (estilo opcional)
    setTimeout(() => element.classList.add('ghost'), 0);
  });

  element.addEventListener('dragend', (e) => {
    element.classList.remove('dragging', 'ghost');
    clearAllDragClasses();
  });

  element.addEventListener('dragover', (e) => {
    e.preventDefault(); // Permite soltar
    
    // Si estamos sobre el mismo elemento que arrastramos, no hacer nada
    if (dragSrcId === node.id) return;

    const rect = element.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    // Limpiamos clases de ESTE elemento antes de recalcular
    element.classList.remove('drag-top', 'drag-bottom', 'drag-inside');

    // Lógica de zonas
    if (node.type === 'folder') {
      // Carpetas: 25% arriba, 50% centro (dentro), 25% abajo
      if (offsetY < height * 0.25) element.classList.add('drag-top');
      else if (offsetY > height * 0.75) element.classList.add('drag-bottom');
      else element.classList.add('drag-inside');
    } else {
      // Prompts: 50% arriba, 50% abajo
      if (offsetY < height * 0.5) element.classList.add('drag-top');
      else element.classList.add('drag-bottom');
    }
  });

  element.addEventListener('dragleave', (e) => {
    // Solo quitamos la clase si salimos realmente del elemento visual
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
  
  // 1. Extraer
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

  // 2. Insertar
  if (position === 'inside') {
    const targetNode = findNode(treeData, targetId);
    if (targetNode && targetNode.children) {
      targetNode.children.push(nodeToMove);
      targetNode.isOpen = true; 
    }
  } else {
    // Insertar antes o después
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

// --- RESTO DEL CÓDIGO (Sin cambios funcionales) ---

async function handleInject(node) {
  let content = node.content;
  const allMatches = [...content.matchAll(/{{(.*?)}}/g)];
  const uniqueVars = [...new Set(allMatches.map(match => match[1]))];

  if (uniqueVars.length > 0) {
    for (const varName of uniqueVars) {
      const value = await askUserForValue(varName);
      if (value !== null) {
        content = content.replaceAll(`{{${varName}}}`, value);
      } else {
        return; 
      }
    }
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "injectPrompt", text: content })
      .catch(error => {
        console.error("Error:", error);
        alert("Error: Recarga la página (F5) para reconectar la extensión.");
      });
  }
}

function askUserForValue(varName) {
  return new Promise((resolve) => {
    const modal = document.getElementById('varModal');
    const title = document.getElementById('varNameTitle');
    const input = document.getElementById('varInput');
    const confirmBtn = document.getElementById('varConfirmBtn');
    const cancelBtn = document.getElementById('varCancelBtn');

    title.innerText = varName;
    input.value = ''; 
    modal.classList.remove('hidden');
    input.focus();

    const cleanup = () => {
      modal.classList.add('hidden');
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    confirmBtn.onclick = () => { const val = input.value; cleanup(); resolve(val); };
    cancelBtn.onclick = () => { cleanup(); resolve(null); };
  });
}

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
  const result = await chrome.storage.local.get(['promptTree']);
  treeData = result.promptTree || [];
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