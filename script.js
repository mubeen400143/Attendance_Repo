/*
  Dawat-E-Mehnat Dynamic List Manager
  Features:
   - Seed initial static lists into localStorage (one-time)
   - Persist lists & items in localStorage between visits
   - Add new names to each list via inline form
   - Create entirely new lists (with optional initial names)
   - Remove individual lists
   - Clear all saved data
   - Export all lists to a PDF (using jsPDF)
*/

(function(){
  const STORAGE_KEY = 'dawatLists';
  const listsContainer = document.getElementById('listsContainer');
  const newListForm = document.getElementById('newListForm');
  const exportBtn = document.getElementById('exportPdfBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const toastContainer = document.getElementById('toastContainer');
  const themeToggle = document.getElementById('themeToggle');
  const searchInput = document.getElementById('searchInput');
  const THEME_KEY = 'dawatTheme';

  /** Data Shape
   * lists: [ { id: string, title: string, items: [string], createdAt: ISOString } ]
  */
  function loadData(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { lists: [] };
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed.lists)) return { lists: [] };
      return parsed;
    } catch(e){
      console.warn('Failed to parse storage, resetting.', e);
      return { lists: [] };
    }
  }

  function saveData(data){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function uuid(){
    return 'xxxxxx'.replace(/x/g, () => (Math.random()*36|0).toString(36));
  }

  function seedFromDOMIfNeeded(){
    const data = loadData();
    if(data.lists.length > 0) return; // already seeded
    const seedCards = listsContainer.querySelectorAll('.card[data-seed="true"]');
    const lists = [];
    seedCards.forEach(card => {
      const titleEl = card.querySelector('.first-name');
      const listEl = card.querySelector('.name-list');
      if(!titleEl || !listEl) return;
      const title = titleEl.textContent.trim();
      const items = [...listEl.querySelectorAll('li')].map(li => li.textContent.trim()).filter(Boolean);
      lists.push({ id: uuid(), title, items, createdAt: new Date().toISOString() });
    });
    saveData({ lists });
  }

  function clearRenderedLists(){
    listsContainer.innerHTML = ''; // remove everything (seed markup too)
  }

  function renderLists(){
    const { lists } = loadData();
    clearRenderedLists();
    const filter = (searchInput?.value || '').trim().toLowerCase();
    lists.forEach(listObj => {
      const card = renderSingleList(listObj);
      if(filter){
        const hay = (listObj.title + ' ' + listObj.items.join(' ')).toLowerCase();
        if(!hay.includes(filter)) card.classList.add('filtered-out');
      }
      listsContainer.appendChild(card);
    });
    setupDragAndDrop();
  }

  function renderSingleList(listObj){
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = listObj.id;
  card.setAttribute('draggable','true');

    const h = document.createElement('h1');
    h.className = 'first-name';
  h.innerHTML = `<strong class="title-text">${escapeHtml(listObj.title)}</strong>`;
    card.appendChild(h);
  enableInlineTitleEdit(h, listObj.id);

    const ul = document.createElement('ul');
    ul.className = 'name-list';
    listObj.items.forEach((item, idx) => {
      const li = document.createElement('li');
      li.dataset.index = idx;
      const span = document.createElement('span');
      span.className = 'item-text';
      span.textContent = item;
      li.appendChild(span);
      // delete button
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'remove-item-btn';
      del.innerHTML = '<svg class="icon" width="14" height="14" aria-hidden="true"><use href="#icon-trash"/></svg>';
      del.title = 'Delete name';
      del.setAttribute('aria-label','Delete name');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeItemFromList(listObj.id, idx);
      });
      li.appendChild(del);
      enableInlineItemEdit(li, listObj.id, idx);
      ul.appendChild(li);
    });
    card.appendChild(ul);

    // Add item form
    const form = document.createElement('form');
    form.className = 'add-item-form';
    form.innerHTML = `
      <label class="sr-only" for="add-${listObj.id}">Add name to ${escapeHtml(listObj.title)}</label>
      <input type="text" id="add-${listObj.id}" name="name" placeholder="Add name" required />
      <button type="submit" aria-label="Add name" title="Add name"><svg class="icon" width="16" height="16" aria-hidden="true"><use href="#icon-add"/></svg></button>
    `;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('input[name="name"]');
      const value = input.value.trim();
      if(!value) return;
      addItemToList(listObj.id, value);
      input.value='';
      input.focus();
    });
    card.appendChild(form);

    // List actions
    const actions = document.createElement('div');
    actions.className = 'list-actions';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-list-btn';
  removeBtn.innerHTML = '<svg class="icon" width="16" height="16" aria-hidden="true"><use href="#icon-trash"/></svg>';
    removeBtn.addEventListener('click', () => {
      if(confirm(`Remove the list "${listObj.title}"?`)){
        removeList(listObj.id);
      }
    });
    actions.appendChild(removeBtn);
    card.appendChild(actions);

    return card;
  }

  function addItemToList(listId, item){
    const data = loadData();
    const target = data.lists.find(l => l.id === listId);
    if(!target) return;
    target.items.push(item);
    saveData(data);
    renderLists();
    showToast('Name added','success');
  }

  function removeList(listId){
    const data = loadData();
    const next = data.lists.filter(l => l.id !== listId);
    saveData({ lists: next });
    renderLists();
    showToast('List removed','success');
  }

  function addNewList(title, items){
    const data = loadData();
    data.lists.push({ id: uuid(), title, items: items.slice(), createdAt: new Date().toISOString() });
    saveData(data);
    renderLists();
    showToast('List created','success');
  }

  function handleNewListSubmit(){
    newListForm.addEventListener('submit', e => {
      e.preventDefault();
      const titleInput = document.getElementById('newListTitle');
      const itemsInput = document.getElementById('newListItems');
      const title = titleInput.value.trim();
      if(!title){
        titleInput.focus();
        return;
      }
      const items = itemsInput.value.split(/\n+/).map(s => s.trim()).filter(Boolean);
      addNewList(title, items);
      // Reset form
      newListForm.reset();
      titleInput.focus();
    });
  }

  async function ensureJsPDF(){
    if(typeof window.jspdf !== 'undefined' || typeof window.jsPDF !== 'undefined') return;
    // Attempt dynamic injection (fallback if original tag failed due to SRI / network)
    const candidateSrcs = [
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
    ];
    for(const src of candidateSrcs){
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
            s.src = src;
            s.onload = () => resolve();
            s.onerror = reject;
            document.head.appendChild(s);
        });
        if(typeof window.jspdf !== 'undefined' || typeof window.jsPDF !== 'undefined') return;
      } catch(e){ /* try next */ }
    }
    throw new Error('jsPDF failed to load from all sources.');
  }

  async function exportToPDF(){
    try {
      await ensureJsPDF();
    } catch(err){
      alert('Unable to load jsPDF. Please check your internet connection.');
      return;
    }
    const { jsPDF } = window.jspdf || window;
    if(!jsPDF){
      alert('jsPDF library still not available.');
      return;
    }
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 36; // 0.5 inch
    const lineHeight = 16;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = margin;

    const data = loadData();

    doc.setFont('helvetica','bold');
    doc.setFontSize(18);
    doc.text('Dawat-E-Mehnat Lists', margin, y);
    y += lineHeight*1.5;

    doc.setFontSize(10);
    doc.setFont('helvetica','normal');
    doc.text('Exported: ' + new Date().toLocaleString(), margin, y);
    y += lineHeight*1.5;

    data.lists.forEach((list, idx) => {
      const needed = lineHeight * (2 + list.items.length); // approximate lines needed
      if(y + needed > pageHeight - margin){
        doc.addPage();
        y = margin;
      }
      doc.setFont('helvetica','bold');
      doc.setFontSize(14);
      doc.text(`${idx+1}. ${list.title}`, margin, y);
      y += lineHeight;
      doc.setFont('helvetica','normal');
      doc.setFontSize(11);
      list.items.forEach((item, i) => {
        if(y + lineHeight > pageHeight - margin){
          doc.addPage();
          y = margin;
        }
        doc.text(`  ${i+1}) ${item}`, margin, y);
        y += lineHeight;
      });
      y += lineHeight * 0.5;
    });

    const filename = `Dawat_E_Mehnat_Lists_${new Date().toISOString().replace(/[:T]/g,'-').split('.')[0]}.pdf`;
    doc.save(filename);
    showToast('PDF exported','success');
  }

  function attachExport(){
    exportBtn.addEventListener('click', exportToPDF);
  }

  function attachClearAll(){
    clearAllBtn.addEventListener('click', () => {
      if(confirm('This will remove ALL saved lists. Continue?')){
        localStorage.removeItem(STORAGE_KEY);
        // Re-seed from original markup (if any still present) by reloading
        location.reload();
      }
    });
  }

  function escapeHtml(str){
    return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\'':'&#39;','"':'&quot;'}[c]));
  }

  // Toast system
  function showToast(msg, type='info', timeout=2600){
    if(!toastContainer) return;
    const el = document.createElement('div');
    el.className = `toast ${type==='error'?'error':''} ${type==='success'?'success':''}`.trim();
    el.innerHTML = `<span>${escapeHtml(msg)}</span><button class="toast-close" aria-label="Close">×</button>`;
    toastContainer.appendChild(el);
    const remove = () => {
      el.style.animation = 'toastOut .35s forwards';
      setTimeout(()=> el.remove(), 340);
    };
    el.querySelector('.toast-close').addEventListener('click', remove);
    setTimeout(remove, timeout);
  }

  // Inline editing - title
  function enableInlineTitleEdit(headerEl, listId){
    const strong = headerEl.querySelector('.title-text');
    if(!strong) return;
    headerEl.addEventListener('dblclick', () => {
      if(headerEl.querySelector('input')) return;
      const current = strong.textContent.trim();
      const input = document.createElement('input');
      input.type = 'text';
      input.value = current;
      input.className = 'inline-edit-input';
      strong.replaceWith(input);
      input.focus();
      input.select();
      const finish = (commit) => {
        const val = commit ? input.value.trim() || current : current;
        updateListTitle(listId, val);
      };
      input.addEventListener('keydown', e => {
        if(e.key==='Enter') finish(true);
        else if(e.key==='Escape') finish(false);
      });
      input.addEventListener('blur', () => finish(true));
    });
  }

  function updateListTitle(listId, newTitle){
    const data = loadData();
    const target = data.lists.find(l => l.id === listId);
    if(!target) return;
    if(target.title!==newTitle){
      target.title = newTitle;
      saveData(data);
      showToast('Title updated','success');
    }
    renderLists();
  }

  // Inline editing - list items
  function enableInlineItemEdit(li, listId, itemIndex){
    li.addEventListener('dblclick', () => {
      if(li.querySelector('input')) return;
      const original = li.textContent.trim();
      li.classList.add('editing');
      const input = document.createElement('input');
      input.type='text';
      input.value=original;
      input.className='inline-edit-input';
      li.textContent='';
      li.appendChild(input);
      input.focus();
      input.select();
      const finish = (commit) => {
        const val = commit ? input.value.trim() : original;
        if(commit && val!==original){ updateItemValue(listId, itemIndex, val); }
        else renderLists();
      };
      input.addEventListener('keydown', e => {
        if(e.key==='Enter') finish(true);
        else if(e.key==='Escape') finish(false);
      });
      input.addEventListener('blur', () => finish(true));
    });
  }

  function updateItemValue(listId, idx, newVal){
    const data = loadData();
    const target = data.lists.find(l => l.id===listId);
    if(!target) return; 
    target.items[idx] = newVal;
    saveData(data);
    showToast('Name updated','success');
    renderLists();
  }

  function removeItemFromList(listId, idx){
    const data = loadData();
    const target = data.lists.find(l => l.id===listId);
    if(!target) return;
    target.items.splice(idx,1);
    saveData(data);
    showToast('Name deleted','success');
    renderLists();
  }

  // Search filtering
  function initSearch(){
    if(!searchInput) return;
    searchInput.addEventListener('input', () => {
      renderLists();
    });
  }

  // Drag & Drop (lists only)
  function setupDragAndDrop(){
    const cards = [...listsContainer.querySelectorAll('.card')];
    let dragId = null; let placeholder = null;
    cards.forEach(card => {
      card.addEventListener('dragstart', e => {
        dragId = card.dataset.id;
        card.classList.add('dragging');
        placeholder = document.createElement('div');
        placeholder.className = 'drop-indicator';
        e.dataTransfer.effectAllowed='move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        if(placeholder) placeholder.remove();
        dragId = null; placeholder=null;
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        if(!dragId || card.classList.contains('dragging')) return;
        const rect = card.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height/2;
        if(placeholder && placeholder.parentElement) placeholder.remove();
        if(before) card.parentElement.insertBefore(placeholder, card);
        else card.parentElement.insertBefore(placeholder, card.nextSibling);
      });
      card.addEventListener('drop', e => {
        e.preventDefault();
        if(!dragId) return;
        applyReorder(dragId, placeholder, cards);
      });
    });
    listsContainer.addEventListener('drop', e => {
      if(!dragId) return;
      applyReorder(dragId, placeholder, cards);
    });
  }

  function applyReorder(dragId, placeholder, cards){
    if(!placeholder) return;
    const data = loadData();
    const fromIndex = data.lists.findIndex(l=>l.id===dragId);
    if(fromIndex===-1) return;
    // Determine new index relative to placeholder position
    const siblings = [...listsContainer.children].filter(el => el!==placeholder);
    let toIndex = siblings.indexOf(placeholder.nextElementSibling);
    if(toIndex === -1) toIndex = siblings.length; // moved to end
    const [moved] = data.lists.splice(fromIndex,1);
    data.lists.splice(toIndex,0,moved);
    saveData(data);
    showToast('Order updated','success');
    renderLists();
  }

  // Theme switcher
  function applyTheme(t){
    if(t==='dark') document.body.classList.add('dark');
    else document.body.classList.remove('dark');
    if(themeToggle){
      themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    }
  }
  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY) || 'light';
    applyTheme(saved);
    if(themeToggle){
      themeToggle.addEventListener('click', () => {
        const next = document.body.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    }
  }

  // Initialization sequence
  seedFromDOMIfNeeded();
  renderLists();
  handleNewListSubmit();
  attachExport();
  attachClearAll();
  initTheme();
  initSearch();
})();
