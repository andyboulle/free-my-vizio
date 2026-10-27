const params = new URLSearchParams(location.hash.slice(1));
let token = params.get('t') || localStorage.getItem('fmv-admin-token') || '';
if (token) { localStorage.setItem('fmv-admin-token', token); history.replaceState(null, '', location.pathname); }
const message = document.querySelector('#message');
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: {'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...(options.headers || {})} });
  const value = await response.json(); if (!response.ok) throw new Error(value.error || value.errors?.join(', ') || 'request failed'); return value;
}
const text = (id, value) => { document.querySelector(id).textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
let config;
function renderLayout() {
  const layout = document.querySelector('#layout'); layout.replaceChildren();
  for (const section of config.home.sections) {
    const heading = document.createElement('h3'); heading.textContent = section.title; layout.append(heading);
    section.shortcuts.forEach((shortcut, index) => {
      const row = document.createElement('div'); row.className = 'shortcut';
      row.innerHTML = `<input value="${shortcut.label.replaceAll('"','&quot;')}" aria-label="label"><button data-action="up">↑</button><button data-action="down">↓</button><button data-action="hide">${shortcut.hidden?'Unhide':'Hide'}</button>`;
      row.querySelector('input').onchange = e => shortcut.label = e.target.value;
      row.querySelector('[data-action=hide]').onclick = () => {
        if (shortcut.id !== 'native-home') { shortcut.hidden = !shortcut.hidden; renderLayout(); }
      };
      row.querySelector('[data-action=up]').onclick = () => {
        if (index) [section.shortcuts[index-1],section.shortcuts[index]]=[section.shortcuts[index],section.shortcuts[index-1]];
        renderLayout();
      };
      row.querySelector('[data-action=down]').onclick = () => {
        if (index < section.shortcuts.length-1) [section.shortcuts[index+1],section.shortcuts[index]]=[section.shortcuts[index],section.shortcuts[index+1]];
        renderLayout();
      };
      layout.append(row);
    });
  }
}
async function refresh() {
  try {
    config = await api('/api/admin/config'); const diagnostics = await api('/api/admin/diagnostics');
    text('#status', diagnostics.takeover || diagnostics); text('#diagnostics', diagnostics);
    document.querySelector('#enabled').checked = config.takeover.enabled; document.querySelector('#mode').value = config.takeover.mode;
    renderLayout();
  } catch (error) { message.textContent = error.message; }
}
document.querySelector('#save').onclick = async () => { try { config = await api('/api/admin/config',{method:'PUT',body:JSON.stringify(config)}); message.textContent='Saved'; } catch(error){message.textContent=error.message;} };
document.querySelector('#pair').onclick = async () => { try { await api('/api/admin/pair/start',{method:'POST',body:'{}'}); message.textContent='Enter the PIN shown on the TV'; } catch(error){message.textContent=error.message;} };
document.querySelector('#finish').onclick = async () => { try { await api('/api/admin/pair/finish',{method:'POST',body:JSON.stringify({pin:document.querySelector('#pin').value})}); message.textContent='Paired'; } catch(error){message.textContent=error.message;} };
document.querySelector('#open').onclick = () => api('/api/admin/open-ui',{method:'POST',body:'{}'}).catch(error=>message.textContent=error.message);
document.querySelector('#takeover').onclick = () => api('/api/admin/takeover',{method:'POST',body:JSON.stringify({enabled:document.querySelector('#enabled').checked,mode:document.querySelector('#mode').value})}).then(refresh).catch(error=>message.textContent=error.message);
refresh();
