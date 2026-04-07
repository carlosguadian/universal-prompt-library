// sidepanel.js - Versión con Historial de Variables y Valores por Defecto

let libraries = {};         // { libId: { name, prompts, lastModified } }
let activeLibraryId = null; // ID de la biblioteca activa
let treeData = [];          // Referencia a libraries[activeLibraryId].prompts
let dragSrcId = null;
let editingId = null;
let variableHistory = {};   // Historial compartido entre bibliotecas
let lastModifiedTimestamp = null;
let openContextMenu = null; // Referencia al menú contextual abierto (para cerrarlo al hacer clic fuera)

document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  await loadData();
  loadDarkMode();
  applyTranslations();
  renderLangSelector();
  renderTree();
  renderLibrarySelector();
  setupEventListeners();
});

// --- I18N HELPERS ---
function applyTranslations() {
  // Header inputs / buttons
  const search = document.getElementById('searchInput');
  if (search) search.placeholder = t('header.search');
  const setTitle = (id, key) => { const el = document.getElementById(id); if (el) el.title = t(key); };
  setTitle('addFolderBtn', 'header.newFolder');
  setTitle('addPromptBtn', 'header.newPrompt');
  setTitle('exportBtn', 'header.backup');
  setTitle('importBtn', 'header.restore');
  setTitle('langBtn', 'header.language');
  // Dark mode title is handled by updateDarkModeIcon

  // Modal de edición
  const itemTitle = document.getElementById('itemTitle');
  if (itemTitle) itemTitle.placeholder = t('modal.title');
  const itemContent = document.getElementById('itemContent');
  if (itemContent) itemContent.placeholder = t('modal.promptPlaceholder');
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.textContent = t('modal.save');
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.textContent = t('modal.cancel');

  // Modal de variables
  const setText = (id, key) => { const el = document.getElementById(id); if (el) el.textContent = t(key); };
  setText('varModalTitleLabel', 'var.title');
  setText('varModalDescription', 'var.description');
  const dCancel = document.getElementById('dynamicCancelBtn');
  if (dCancel) dCancel.textContent = t('var.cancel');
  const dBack = document.getElementById('dynamicBackBtn');
  if (dBack) dBack.textContent = t('var.back');
  // Prefijo del hint Ctrl+Enter — derivar de var.hint quitando {action}
  const hintPrefix = document.getElementById('varModalHintPrefix');
  if (hintPrefix) hintPrefix.textContent = t('var.hint', { action: '' }).trim();

  // Footer
  setText('footerPromo', 'footer.promo');
  setText('footerSubscribe', 'footer.subscribe');
  setText('footerMadeBy', 'footer.madeBy');

  // Dark mode icon (refrescar título según locale actual)
  updateDarkModeIcon(document.body.classList.contains('dark-mode'));

  // Last modified label
  updateLastModifiedUI();
}

function renderLangSelector() {
  const dropdown = document.getElementById('langDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';
  const current = getCurrentLocale();
  const langs = [
    { code: 'es', label: 'Español' },
    { code: 'en', label: 'English' },
    { code: 'ca', label: 'Català' }
  ];
  langs.forEach(({ code, label }) => {
    const item = document.createElement('div');
    item.className = 'lang-dropdown-item' + (code === current ? ' active' : '');
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.style.fontSize = '16px';
    icon.textContent = code === current ? 'check' : 'language';
    const name = document.createElement('span');
    name.textContent = label;
    item.append(icon, name);
    item.onclick = async (e) => {
      e.stopPropagation();
      await setLocale(code);
      applyTranslations();
      renderLangSelector();
      renderLibrarySelector();
      renderTree();
      closeLangDropdown();
    };
    dropdown.appendChild(item);
  });
}

function toggleLangDropdown() {
  document.getElementById('langDropdown').classList.toggle('hidden');
}

function closeLangDropdown() {
  document.getElementById('langDropdown').classList.add('hidden');
}

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
    btn.title = isDark ? t('header.lightMode') : t('header.darkMode');
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
    
    // Acciones primarias (visibles directamente)
    if (node.type === 'prompt') {
      actions.appendChild(createActionBtn('send', () => handleInject(node)));
      actions.appendChild(createActionBtn('content_copy', () => {
        copyToClipboard(node.content);
        node.useCount = (node.useCount || 0) + 1;
        node.lastUsed = Date.now();
        saveData(false);
      }));
    }

    // Menú contextual (⋮) con acciones secundarias
    const moreWrapper = document.createElement('div');
    moreWrapper.className = 'more-wrapper';

    const moreBtn = createActionBtn('more_vert', (e) => {
      toggleContextMenu(moreWrapper, node);
    });
    moreWrapper.appendChild(moreBtn);
    actions.appendChild(moreWrapper);

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
          saveData(false);
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
      const result = onClick(e);
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

// --- MENÚ CONTEXTUAL (⋮) ---
function toggleContextMenu(wrapper, node) {
  // Cerrar cualquier menú abierto en otro nodo
  if (openContextMenu && openContextMenu !== wrapper) {
    const existing = openContextMenu.querySelector('.context-menu');
    if (existing) existing.remove();
  }

  let menu = wrapper.querySelector('.context-menu');
  if (menu) {
    menu.remove();
    openContextMenu = null;
    return;
  }

  menu = document.createElement('div');
  menu.className = 'context-menu open';

  const otherLibraries = Object.entries(libraries).filter(([id]) => id !== activeLibraryId);
  const canMove = otherLibraries.length > 0;

  // Helper para crear un item del menú
  const createItem = ({ icon, label, danger, action, isSubItem, expandable }) => {
    const item = document.createElement('div');
    item.className = 'context-menu-item' + (danger ? ' danger' : '') + (isSubItem ? ' sub-item' : '');

    const iconEl = document.createElement('span');
    iconEl.className = 'material-icons';
    iconEl.style.fontSize = '16px';
    iconEl.textContent = icon;

    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    labelEl.style.flex = '1';

    item.append(iconEl, labelEl);

    if (expandable) {
      const arrow = document.createElement('span');
      arrow.className = 'material-icons expand-arrow';
      arrow.style.fontSize = '16px';
      arrow.style.color = '#999';
      arrow.textContent = 'expand_more';
      item.appendChild(arrow);
    }

    item.onmousedown = (e) => e.stopPropagation();
    item.onclick = (e) => {
      e.stopPropagation();
      action(item);
    };
    return item;
  };

  // 1. Favorito
  menu.appendChild(createItem({
    icon: node.isFavorite ? 'star' : 'star_border',
    label: node.isFavorite ? t('node.removeFavorite') : t('node.addFavorite'),
    action: () => { closeAllContextMenus(); toggleFavorite(node.id); }
  }));

  // 2. Duplicar
  menu.appendChild(createItem({
    icon: 'file_copy',
    label: t('node.duplicate'),
    action: () => { closeAllContextMenus(); duplicateNode(node.id); }
  }));

  // 3. Mover a biblioteca... (con expansión inline)
  if (canMove) {
    const moveItem = createItem({
      icon: 'drive_file_move',
      label: t('node.moveTo'),
      expandable: true,
      action: (itemEl) => {
        // Toggle: si ya está expandido, colapsar
        const isExpanded = itemEl.classList.contains('expanded');
        // Limpiar cualquier expansión previa
        menu.querySelectorAll('.sub-item').forEach(el => el.remove());
        menu.querySelectorAll('.context-menu-item.expanded').forEach(el => {
          el.classList.remove('expanded');
          const arr = el.querySelector('.expand-arrow');
          if (arr) arr.textContent = 'expand_more';
        });

        if (isExpanded) return; // ya estaba abierto: solo cerramos

        itemEl.classList.add('expanded');
        const arr = itemEl.querySelector('.expand-arrow');
        if (arr) arr.textContent = 'expand_less';

        // Insertar items de bibliotecas destino justo después
        let insertAfter = itemEl;
        otherLibraries.forEach(([id, lib]) => {
          const subItem = createItem({
            icon: 'folder_special',
            label: lib.name,
            isSubItem: true,
            action: () => {
              closeAllContextMenus();
              moveNodeToLibrary(node.id, id);
            }
          });
          insertAfter.after(subItem);
          insertAfter = subItem;
        });
      }
    });
    menu.appendChild(moveItem);
  }

  // 4. Editar
  menu.appendChild(createItem({
    icon: 'edit',
    label: t('node.edit'),
    action: () => { closeAllContextMenus(); openModal(node.type, node.id); }
  }));

  // 5. Eliminar
  menu.appendChild(createItem({
    icon: 'delete',
    label: t('node.delete'),
    danger: true,
    action: () => { closeAllContextMenus(); deleteNode(node.id); }
  }));

  wrapper.appendChild(menu);
  openContextMenu = wrapper;
}

function moveNodeToLibrary(nodeId, targetLibraryId) {
  if (!libraries[targetLibraryId] || targetLibraryId === activeLibraryId) return;

  // Extraer el nodo (con todos sus hijos) de la biblioteca actual
  let extracted = null;
  const remove = (nodes) => {
    const idx = nodes.findIndex(n => n.id === nodeId);
    if (idx > -1) {
      extracted = nodes[idx];
      nodes.splice(idx, 1);
      return true;
    }
    for (const n of nodes) {
      if (n.children && remove(n.children)) return true;
    }
    return false;
  };
  remove(treeData);

  if (!extracted) return;

  // Insertar en la raíz de la biblioteca destino
  if (!Array.isArray(libraries[targetLibraryId].prompts)) {
    libraries[targetLibraryId].prompts = [];
  }
  libraries[targetLibraryId].prompts.push(extracted);
  libraries[targetLibraryId].lastModified = Date.now();

  // Guardar ambas bibliotecas
  saveData();
  renderTree();

  const targetName = libraries[targetLibraryId].name;
  const key = extracted.type === 'folder' ? 'node.movedFolder' : 'node.movedPrompt';
  showToast(t(key, { name: targetName }));
}

function closeAllContextMenus() {
  if (openContextMenu) {
    const menu = openContextMenu.querySelector('.context-menu');
    if (menu) menu.remove();
    openContextMenu = null;
  }
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
      alert(t('inject.noContent'));
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

  // Tracking de uso (no actualiza timestamp — no es un cambio en la biblioteca)
  node.useCount = (node.useCount || 0) + 1;
  node.lastUsed = Date.now();
  saveData(false);

  // Inyección final
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { action: "injectPrompt", text: content })
      .catch(error => {
        console.error("Error sendMessage:", error);
        alert(t('inject.reloadNeeded'));
      });
  } else {
    alert(t('inject.noActiveTab'));
  }
  } catch (err) {
    console.error('Error en handleInject:', err);
    alert(t('inject.unexpectedError', { message: err.message }));
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
  label.textContent = t('var.history');
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
    document.getElementById('varStepIndicator').textContent = t('var.step', { current: currentIndex + 1, total: totalVars });

    const input = document.getElementById('dynamicVarInput');
    input.value = defaultValue || '';
    input.placeholder = defaultValue ? t('var.defaultPlaceholder', { value: defaultValue }) : t('var.emptyPlaceholder');
    input.style.borderColor = '';

    const confirmBtn = document.getElementById('dynamicConfirmBtn');
    confirmBtn.textContent = isLastStep ? t('var.insert') : t('var.next');

    const backBtn = document.getElementById('dynamicBackBtn');
    backBtn.classList.toggle('hidden', currentIndex === 0);

    document.getElementById('varHintAction').textContent = isLastStep ? t('var.hintInsert') : t('var.hintNext');

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
  showToast(node.isFavorite ? t('node.favoriteAdded') : t('node.favoriteRemoved'));
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
  showToast(t('node.duplicated'));
}

function deleteNode(id) {
  if(confirm(t('node.deleteConfirm'))) {
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
  const result = await chrome.storage.local.get([
    'libraries', 'activeLibraryId', 'varHistory',
    'promptTree', 'lastModified' // legacy
  ]);

  variableHistory = result.varHistory || {};

  if (result.libraries && typeof result.libraries === 'object' && Object.keys(result.libraries).length > 0) {
    // Formato nuevo
    libraries = result.libraries;
    activeLibraryId = result.activeLibraryId && libraries[result.activeLibraryId]
      ? result.activeLibraryId
      : Object.keys(libraries)[0];
  } else {
    // Migración desde formato legacy
    const legacyTree = result.promptTree || [];
    const legacyTimestamp = result.lastModified || null;
    const defaultId = crypto.randomUUID();
    libraries = {
      [defaultId]: {
        name: t('library.default'),
        prompts: legacyTree,
        lastModified: legacyTimestamp
      }
    };
    activeLibraryId = defaultId;
    // Guardar migración inmediatamente
    chrome.storage.local.set({ libraries, activeLibraryId });
    chrome.storage.local.remove(['promptTree', 'lastModified']);
  }

  treeData = libraries[activeLibraryId].prompts;
  lastModifiedTimestamp = libraries[activeLibraryId].lastModified || null;

  updateLastModifiedUI();
}

function saveData(updateTimestamp = true) {
  if (updateTimestamp) {
    lastModifiedTimestamp = Date.now();
    libraries[activeLibraryId].lastModified = lastModifiedTimestamp;
  }
  // Asegurar que treeData y libraries[activeLibraryId].prompts son la misma referencia
  libraries[activeLibraryId].prompts = treeData;

  chrome.storage.local.set({
    libraries,
    activeLibraryId,
    varHistory: variableHistory
  });
  updateLastModifiedUI();
}
// --- GESTIÓN DE BIBLIOTECAS ---
function renderLibrarySelector() {
  const nameEl = document.getElementById('libraryName');
  if (nameEl) nameEl.textContent = libraries[activeLibraryId]?.name || t('library.default');

  const dropdown = document.getElementById('libraryDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';

  // Listar bibliotecas existentes
  Object.entries(libraries).forEach(([id, lib]) => {
    const item = document.createElement('div');
    item.className = 'library-dropdown-item' + (id === activeLibraryId ? ' active' : '');

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.style.fontSize = '16px';
    icon.textContent = id === activeLibraryId ? 'check' : 'folder_special';

    const name = document.createElement('span');
    name.className = 'library-item-name';
    name.textContent = lib.name;

    const actions = document.createElement('span');
    actions.className = 'library-item-actions';

    const editIcon = document.createElement('span');
    editIcon.className = 'material-icons library-item-action';
    editIcon.textContent = 'edit';
    editIcon.title = t('library.rename');
    editIcon.onclick = (e) => { e.stopPropagation(); renameLibrary(id); };

    const deleteIcon = document.createElement('span');
    deleteIcon.className = 'material-icons library-item-action danger';
    deleteIcon.textContent = 'delete';
    deleteIcon.title = t('library.delete');
    deleteIcon.onclick = (e) => { e.stopPropagation(); deleteLibrary(id); };

    actions.append(editIcon, deleteIcon);

    item.append(icon, name, actions);
    item.onclick = () => { switchLibrary(id); closeDropdown(); };
    dropdown.appendChild(item);
  });

  // Separador
  const divider = document.createElement('div');
  divider.className = 'library-dropdown-divider';
  dropdown.appendChild(divider);

  // Opción "Nueva biblioteca"
  const newItem = document.createElement('div');
  newItem.className = 'library-dropdown-item new-library';
  const plusIcon = document.createElement('span');
  plusIcon.className = 'material-icons';
  plusIcon.style.fontSize = '16px';
  plusIcon.textContent = 'add';
  const newLabel = document.createElement('span');
  newLabel.textContent = t('library.newLibrary');
  newItem.append(plusIcon, newLabel);
  newItem.onclick = () => { createLibrary(); closeDropdown(); };
  dropdown.appendChild(newItem);
}

function toggleDropdown() {
  document.getElementById('libraryDropdown').classList.toggle('hidden');
}

function closeDropdown() {
  document.getElementById('libraryDropdown').classList.add('hidden');
}

function switchLibrary(id) {
  if (!libraries[id] || id === activeLibraryId) return;
  activeLibraryId = id;
  treeData = libraries[id].prompts;
  lastModifiedTimestamp = libraries[id].lastModified || null;
  chrome.storage.local.set({ activeLibraryId });
  renderLibrarySelector();
  renderTree();
  updateLastModifiedUI();
}

function createLibrary() {
  const name = prompt(t('library.newLibraryPrompt'));
  if (!name || !name.trim()) return;
  const id = crypto.randomUUID();
  libraries[id] = { name: name.trim(), prompts: [], lastModified: Date.now() };
  activeLibraryId = id;
  treeData = libraries[id].prompts;
  lastModifiedTimestamp = libraries[id].lastModified;
  chrome.storage.local.set({ libraries, activeLibraryId });
  renderLibrarySelector();
  renderTree();
  updateLastModifiedUI();
  showToast(t('library.created'));
}

function renameLibrary(id) {
  const lib = libraries[id];
  if (!lib) return;
  const newName = prompt(t('library.renamePrompt'), lib.name);
  if (!newName || !newName.trim()) return;
  lib.name = newName.trim();
  chrome.storage.local.set({ libraries });
  renderLibrarySelector();
  showToast(t('library.renamed'));
}

function deleteLibrary(id) {
  if (Object.keys(libraries).length === 1) {
    alert(t('library.deleteLastError'));
    return;
  }
  const lib = libraries[id];
  if (!confirm(t('library.deleteConfirm', { name: lib.name }))) return;
  delete libraries[id];
  if (activeLibraryId === id) {
    activeLibraryId = Object.keys(libraries)[0];
    treeData = libraries[activeLibraryId].prompts;
    lastModifiedTimestamp = libraries[activeLibraryId].lastModified || null;
  }
  chrome.storage.local.set({ libraries, activeLibraryId });
  renderLibrarySelector();
  renderTree();
  updateLastModifiedUI();
  showToast(t('library.deleted'));
}

// NUEVA FUNCIÓN: Para formatear y mostrar la fecha
function updateLastModifiedUI() {
  const displayElement = document.getElementById('lastModified');
  if (!displayElement) return;

  if (!lastModifiedTimestamp) {
    displayElement.innerText = t('header.lastModifiedNever');
    return;
  }

  // Formateamos la fecha al estilo del locale activo
  const localeMap = { es: 'es-ES', en: 'en-US', ca: 'ca-ES' };
  const dateLocale = localeMap[getCurrentLocale()] || 'es-ES';
  const dateObj = new Date(lastModifiedTimestamp);
  const formattedDate = dateObj.toLocaleString(dateLocale, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  displayElement.innerText = t('header.lastModified', { date: formattedDate });
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
    showToast(t('clipboard.copied'));
  }).catch(() => {
    alert(t('clipboard.error'));
  });
}

function setupEventListeners() {
  document.getElementById('addFolderBtn').onclick = () => addNewItem('folder');
  document.getElementById('addPromptBtn').onclick = () => addNewItem('prompt');
  document.getElementById('searchInput').addEventListener('input', (e) => renderTree(e.target.value));
  document.getElementById('darkModeBtn').onclick = toggleDarkMode;

  // Selector de bibliotecas
  document.getElementById('librarySelectorBtn').onclick = (e) => {
    e.stopPropagation();
    toggleDropdown();
  };

  // Selector de idioma
  const langBtn = document.getElementById('langBtn');
  if (langBtn) {
    langBtn.onclick = (e) => {
      e.stopPropagation();
      toggleLangDropdown();
    };
  }

  // Cerrar dropdowns y menú contextual al hacer clic fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.library-selector')) closeDropdown();
    if (!e.target.closest('.lang-selector')) closeLangDropdown();
    if (!e.target.closest('.more-wrapper')) closeAllContextMenus();
  });
  document.getElementById('exportBtn').onclick = () => {
    const libName = libraries[activeLibraryId]?.name || 'biblioteca';
    const exportData = {
      libraryName: libName,
      prompts: treeData,
      variableHistory: variableHistory
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    const safeName = libName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    dlAnchorElem.setAttribute("download", `prompts_${safeName}.json`);
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
          alert(t('import.invalidFormat'));
          return;
        }

        // Validar que cada nodo tiene la estructura mínima esperada
        const isValidNode = (node) => {
          return node && typeof node.id === 'string' && typeof node.title === 'string'
            && (node.type === 'prompt' || node.type === 'folder');
        };
        const validateTree = (nodes) => nodes.every(n => isValidNode(n) && (!n.children || validateTree(n.children)));

        if (!validateTree(importedTree)) {
          alert(t('import.invalidNodes'));
          return;
        }

        // Preguntar destino: nueva biblioteca o reemplazar la activa
        const importedName = (parsed && parsed.libraryName) ? parsed.libraryName : t('library.imported_default');
        const choice = confirm(t('import.askDestination', { name: importedName }));

        if (choice) {
          // Crear nueva biblioteca
          const newId = crypto.randomUUID();
          libraries[newId] = {
            name: importedName,
            prompts: importedTree,
            lastModified: Date.now()
          };
          activeLibraryId = newId;
          treeData = libraries[newId].prompts;
          lastModifiedTimestamp = libraries[newId].lastModified;
        } else {
          // Reemplazar la activa
          treeData = importedTree;
          libraries[activeLibraryId].prompts = treeData;
        }

        if (importedHistory && typeof importedHistory === 'object') {
          variableHistory = { ...variableHistory, ...importedHistory };
        }
        saveData();
        renderLibrarySelector();
        renderTree();
        showToast(t('library.imported'));
      } catch(err) {
        alert(t('import.invalidJson'));
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
    if(!title) return alert(t('modal.titleRequired'));
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
  document.getElementById('modalTitle').innerText = id
    ? (type === 'folder' ? t('modal.editFolder') : t('modal.editPrompt'))
    : (type === 'folder' ? t('modal.newFolder') : t('modal.newPrompt'));
  if (id) {
    const node = findNode(treeData, id);
    titleInput.value = node.title;
    contentInput.value = node.content || '';
    editingId = id;
  } else { titleInput.value = ''; contentInput.value = ''; editingId = null; }
  titleInput.focus();
}