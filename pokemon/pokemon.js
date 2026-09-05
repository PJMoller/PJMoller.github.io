// ---- Pokemon draft plan ----
// Open, no login: fetches and saves pokemon.json through the same
// Cloudflare Worker the /admin panel uses, but through unauthenticated
// routes scoped to just this one file, so anyone with this page open can
// edit and save it, without being able to touch anything else in the repo.

const WORKER_URL = 'https://pjmoller-admin.peetmoller92.workers.dev';

let data = null;
let fileSha = null;

const introInput = document.getElementById('pkmn-intro');
const specialsEl = document.getElementById('pkmn-specials');
const normalsEl = document.getElementById('pkmn-normals');
const conditionalEl = document.getElementById('pkmn-conditional');
const variationsEl = document.getElementById('pkmn-variations');
const addVariationBtn = document.getElementById('pkmn-add-variation');
const saveBtn = document.getElementById('pkmn-save-btn');
const statusEl = document.getElementById('pkmn-status');

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = 'pkmn-status' + (kind ? ' ' + kind : '');
}

// ---- utf-8 safe base64 helpers (plain atob/btoa mangle non-ASCII) ----
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

async function loadPlan() {
  const res = await fetch(WORKER_URL + '/pokemon');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `worker returned ${res.status}`);
  fileSha = body.sha;
  data = JSON.parse(base64ToUtf8(body.content));
}

async function savePlan() {
  const payload = {
    intro: introInput.value,
    specials: readGroup(specialsEl),
    normals: readGroup(normalsEl),
    conditional: readGroup(conditionalEl),
    variations: [...variationsEl.querySelectorAll('input')].map((i) => i.value).filter((v) => v.trim() !== ''),
  };
  const jsonStr = JSON.stringify(payload, null, 2) + '\n';
  const res = await fetch(WORKER_URL + '/pokemon', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: utf8ToBase64(jsonStr), sha: fileSha }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `worker returned ${res.status}`);
  fileSha = body.content.sha;
}

function readGroup(container) {
  return [...container.children].map((row) => ({
    mon: row.querySelector('.pkmn-in-mon').value,
    budget: row.querySelector('.pkmn-in-budget').value,
    alt: row.querySelector('.pkmn-in-alt').value,
    notes: row.querySelector('.pkmn-in-notes').value,
  })).filter((r) => r.mon.trim() !== '');
}

function buildRow(entry) {
  const row = document.createElement('div');
  row.className = 'pkmn-row';

  const monInput = document.createElement('input');
  monInput.className = 'pkmn-in pkmn-in-mon';
  monInput.placeholder = 'mon';
  monInput.value = entry.mon || '';
  row.appendChild(monInput);

  const budgetInput = document.createElement('input');
  budgetInput.className = 'pkmn-in pkmn-in-budget';
  budgetInput.placeholder = '—';
  budgetInput.value = entry.budget || '';
  row.appendChild(budgetInput);

  const altInput = document.createElement('input');
  altInput.className = 'pkmn-in pkmn-in-alt';
  altInput.placeholder = '—';
  altInput.value = entry.alt || '';
  row.appendChild(altInput);

  const notesInput = document.createElement('input');
  notesInput.className = 'pkmn-in pkmn-in-notes';
  notesInput.placeholder = 'notes';
  notesInput.value = entry.notes || '';
  row.appendChild(notesInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'pkmn-remove-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'remove row';
  removeBtn.addEventListener('click', () => row.remove());
  row.appendChild(removeBtn);

  return row;
}

function buildVariationRow(text) {
  const row = document.createElement('div');
  row.className = 'pkmn-variation-row';

  const input = document.createElement('input');
  input.className = 'pkmn-in pkmn-in-variation';
  input.placeholder = 'e.g. sun — Groudon + Lilligant-Hisui';
  input.value = text || '';
  row.appendChild(input);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'pkmn-remove-btn';
  removeBtn.textContent = '×';
  removeBtn.title = 'remove line';
  removeBtn.addEventListener('click', () => row.remove());
  row.appendChild(removeBtn);

  return row;
}

function render() {
  introInput.value = data.intro || '';

  specialsEl.innerHTML = '';
  data.specials.forEach((e) => specialsEl.appendChild(buildRow(e)));

  normalsEl.innerHTML = '';
  data.normals.forEach((e) => normalsEl.appendChild(buildRow(e)));

  conditionalEl.innerHTML = '';
  data.conditional.forEach((e) => conditionalEl.appendChild(buildRow(e)));

  variationsEl.innerHTML = '';
  data.variations.forEach((v) => variationsEl.appendChild(buildVariationRow(v)));
}

document.querySelectorAll('.pkmn-add-btn[data-group]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    const container = { specials: specialsEl, normals: normalsEl, conditional: conditionalEl }[group];
    const row = buildRow({ mon: '', budget: '', alt: '', notes: '' });
    container.appendChild(row);
    row.querySelector('.pkmn-in-mon').focus();
  });
});

addVariationBtn.addEventListener('click', () => {
  const row = buildVariationRow('');
  variationsEl.appendChild(row);
  row.querySelector('input').focus();
});

saveBtn.addEventListener('click', async () => {
  setStatus('saving…');
  saveBtn.disabled = true;
  try {
    await savePlan();
    setStatus('saved.', 'ok');
  } catch (err) {
    setStatus('save failed: ' + err.message, 'err');
  } finally {
    saveBtn.disabled = false;
  }
});

loadPlan()
  .then(render)
  .catch((err) => setStatus('failed to load: ' + err.message, 'err'));
