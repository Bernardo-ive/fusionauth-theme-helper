const $ = (id) => document.getElementById(id);

const state = {
  templates: [],
  currentId: null,
  current: null,
  dirty: false,
};

function setDirty(v) {
  state.dirty = v;
  $('save').disabled = !state.currentId || !state.dirty;
}

function fmt(str) {
  return (str || '').toString();
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json && json.error ? json.error : `Request failed: ${res.status}`;
    const err = new Error(msg);
    err.details = json;
    throw err;
  }
  return json;
}

function renderList() {
  const q = $('q').value.trim().toLowerCase();
  const el = $('list');
  el.innerHTML = '';

  const items = state.templates.filter((t) => {
    const hay = `${t.name || ''} ${t.subject || ''} ${t.id}`.toLowerCase();
    return !q || hay.includes(q);
  });

  for (const t of items) {
    const div = document.createElement('div');
    div.className = `item${t.id === state.currentId ? ' active' : ''}`;
    div.dataset.id = t.id;
    div.innerHTML = `
      <div class="item-title">${escapeHtml(t.name || '(no name)')}</div>
      <div class="item-sub">${escapeHtml(t.subject || '')}</div>
      <div class="item-sub">${escapeHtml(t.id)}</div>
    `;
    div.addEventListener('click', () => selectTemplate(t.id));
    el.appendChild(div);
  }
}

function escapeHtml(s) {
  return fmt(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function refresh() {
  const { templates } = await api('/api/templates');
  state.templates = templates;
  renderList();
}

function bindDirty() {
  const ids = ['name', 'subject', 'fromName', 'fromEmail', 'bodyHtml', 'bodyText'];
  for (const id of ids) {
    $(id).addEventListener('input', () => setDirty(true));
  }
}

function setCurrentToForm() {
  if (!state.current) return;
  $('name').value = state.current.name || '';
  $('subject').value = state.current.subject || '';
  $('fromName').value = state.current.fromName || '';
  $('fromEmail').value = state.current.fromEmail || '';
  $('bodyHtml').value = state.current.bodyHtml || '';
  $('bodyText').value = state.current.bodyText || '';
}

function updateHeader() {
  if (!state.currentId) {
    $('title').textContent = 'Select a template';
    $('meta').textContent = '';
    return;
  }
  const name = (state.current && state.current.name ? state.current.name.trim() : '') || '(no name)';
  $('title').textContent = name;
  $('meta').textContent = state.currentId;
}

async function selectTemplate(id) {
  if (state.dirty && state.currentId && id !== state.currentId) {
    const ok = confirm('You have unsaved changes. Discard them?');
    if (!ok) return;
  }

  state.currentId = id;
  const { template } = await api(`/api/templates/${id}`);
  state.current = template;
  setCurrentToForm();
  updateHeader();
  setDirty(false);
  renderList();
  clearOutput();
}

function clearOutput() {
  $('output').textContent = '';
  $('textPreview').textContent = '';
  $('iframe').srcdoc = '<html><body style="font-family:Arial; padding:20px;">Preview will appear here</body></html>';
}

function currentPayload() {
  return {
    name: $('name').value,
    subject: $('subject').value,
    fromName: $('fromName').value,
    fromEmail: $('fromEmail').value,
    bodyHtml: $('bodyHtml').value,
    bodyText: $('bodyText').value,
  };
}

async function save() {
  if (!state.currentId) return;
  const payload = currentPayload();
  const { template } = await api(`/api/templates/${state.currentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  state.current = template;
  setDirty(false);
  await refresh();
  updateHeader();
  $('output').textContent = 'Saved.';
}

async function duplicate() {
  if (!state.currentId) return;
  const mode = $('brandMode').checked ? 'iveone' : null;
  const { id } = await api(`/api/templates/${state.currentId}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  await refresh();
  await selectTemplate(id);
  $('output').textContent = `Duplicated -> ${id}`;
}

async function validatePreview() {
  if (!state.currentId) return;
  // Save first so preview matches disk.
  if (state.dirty) await save();

  $('output').textContent = 'Previewing via FusionAuth...';
  const locale = $('locale').value.trim();
  const json = await api(`/api/templates/${state.currentId}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale: locale || null }),
  });

  const email = json.email || {};
  $('textPreview').textContent = email.text || '';
  $('iframe').srcdoc = email.html || '<html><body>(No HTML returned)</body></html>';
  const errors = json.errors || {};
  $('output').textContent = JSON.stringify({ email: { subject: email.subject, from: email.from }, errors }, null, 2);
}

async function upload() {
  if (!state.currentId) return;
  if (state.dirty) await save();
  $('output').textContent = 'Uploading via fusionauth CLI...';

  const json = await api(`/api/templates/${state.currentId}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overwrite: false }),
  });

  $('output').textContent = JSON.stringify(json, null, 2);
}

function initTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      for (const t of tabs) t.classList.remove('active');
      tab.classList.add('active');
      const which = tab.dataset.tab;
      for (const ta of document.querySelectorAll('textarea[data-pane]')) {
        ta.classList.toggle('hidden', ta.dataset.pane !== which);
      }
    });
  }
}

async function boot() {
  bindDirty();
  initTabs();
  $('q').addEventListener('input', renderList);
  $('refresh').addEventListener('click', refresh);
  $('save').addEventListener('click', () => save().catch(showError));
  $('duplicate').addEventListener('click', () => duplicate().catch(showError));
  $('validate').addEventListener('click', () => validatePreview().catch(showError));
  $('upload').addEventListener('click', () => upload().catch(showError));

  await refresh();
  clearOutput();
}

function showError(e) {
  const payload = {
    error: e && e.message ? e.message : String(e),
    details: e && e.details ? e.details : undefined,
  };
  $('output').textContent = JSON.stringify(payload, null, 2);
}

boot().catch(showError);
