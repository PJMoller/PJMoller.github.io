// ---- Admin panel: reads and writes projects.json directly in the
// PJMoller.github.io repo via the GitHub REST API, using a personal
// access token pasted in by hand and kept only in this browser's
// localStorage. No backend, no build step, GitHub Pages just picks up
// the new projects.json the next time it rebuilds after a save. ----

const OWNER = 'PJMoller';
const REPO = 'PJMoller.github.io';
const FILE_PATH = 'projects.json';
const BRANCH = 'main';
const TOKEN_KEY = 'pjmoller_admin_token';
const GATE_KEY = 'pjmoller_admin_gate_ok';

// SHA-256 hex digest of the admin password. Only the hash lives in this
// file (which is public, since GitHub Pages serves everything in this
// repo), never the password itself, that only exists in your head.
// Not set yet, everyone stays locked out until this is filled in.
const GATE_HASH = '';

let projects = [];
let fileSha = null;
const readmeCache = new Map(); // project id -> readme text, never saved to projects.json

const lockPanel = document.getElementById('lock-panel');
const adminContent = document.getElementById('admin-content');
const lockBtn = document.getElementById('lock-btn');
const gateInput = document.getElementById('gate-password-input');
const gateBtn = document.getElementById('gate-unlock-btn');
const gateStatus = document.getElementById('gate-status');

const tokenInput = document.getElementById('token-input');
const loadBtn = document.getElementById('load-btn');
const clearTokenBtn = document.getElementById('clear-token-btn');
const authStatus = document.getElementById('auth-status');

const importPanel = document.getElementById('import-panel');
const importUrl = document.getElementById('import-url');
const importBtn = document.getElementById('import-btn');
const importStatus = document.getElementById('import-status');

const projectsPanel = document.getElementById('projects-panel');
const editorEl = document.getElementById('projects-editor');
const addProjectBtn = document.getElementById('add-project-btn');

const saveBar = document.getElementById('save-bar');
const saveBtn = document.getElementById('save-btn');
const saveStatus = document.getElementById('save-status');

// ---- password gate (deterrent only, see note in the HTML) ----
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showUnlocked() {
  lockPanel.hidden = true;
  adminContent.hidden = false;
  lockBtn.hidden = false;
}
function showLocked() {
  lockPanel.hidden = false;
  adminContent.hidden = true;
  lockBtn.hidden = true;
  gateInput.value = '';
}

if (GATE_HASH && localStorage.getItem(GATE_KEY) === GATE_HASH) {
  showUnlocked();
}

gateBtn.addEventListener('click', async () => {
  if (!GATE_HASH) {
    setStatus(gateStatus, 'no password has been configured yet.', 'err');
    return;
  }
  const hash = await sha256Hex(gateInput.value);
  if (hash === GATE_HASH) {
    localStorage.setItem(GATE_KEY, GATE_HASH);
    showUnlocked();
  } else {
    setStatus(gateStatus, 'wrong password.', 'err');
  }
});
gateInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') gateBtn.click();
});
lockBtn.addEventListener('click', () => {
  localStorage.removeItem(GATE_KEY);
  showLocked();
});

// ---- token storage ----
function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}
function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  tokenInput.value = '';
}

const savedToken = getToken();
if (savedToken) tokenInput.value = savedToken;

// ---- utf-8 safe base64 helpers (plain atob/btoa mangle non-ASCII) ----
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

// ---- GitHub API ----
async function ghGet(path) {
  const token = getToken();
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = 'token ' + token;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}&t=${Date.now()}`, { headers });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function ghPut(path, contentStr, message, sha) {
  const token = getToken();
  if (!token) throw new Error('No token set.');
  const body = { message, content: utf8ToBase64(contentStr), branch: BRANCH };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'token ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function ghRepoInfo(owner, repo) {
  const token = getToken();
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = 'token ' + token;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) throw new Error(`GitHub returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// best-effort README fetch, used only to build the "copy prompt for
// claude" text, never saved to projects.json.
async function ghReadme(owner, repo) {
  const token = getToken();
  const headers = { Accept: 'application/vnd.github.raw+json' };
  if (token) headers.Authorization = 'token ' + token;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

function buildClaudePrompt(project, readme) {
  const repoUrl = project.repos[0]?.url || '(no repo link yet)';
  const trimmedReadme = readme ? readme.slice(0, 3000) : '(no README found, just work from the repo name and tags)';
  return `I'm adding a project to my portfolio site (pjmoller.github.io). Here's the repo:

Repo: ${repoUrl}
Name: ${project.title}
Tags so far: ${project.tags.join(', ') || '(none yet)'}
README:
"""
${trimmedReadme}
"""

Write two things for me, in my usual voice: plain, casual, first person where it fits, no em dashes.
1. blurb: 1-2 sentences for a project card.
2. story: 3-5 sentences for a "tap for the story" popup, explaining what it does and anything interesting about how it was built.

Reply with just:
blurb: ...
story: ...`;
}

// ---- helpers ----
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
}
function uniqueId(base) {
  let id = base;
  let n = 2;
  const existing = new Set(projects.map(p => p.id));
  while (existing.has(id)) { id = `${base}-${n}`; n++; }
  return id;
}
function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = 'admin-status' + (kind ? ' ' + kind : '');
}

// ---- load ----
loadBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    setStatus(authStatus, 'paste a token first.', 'err');
    return;
  }
  setToken(token);
  setStatus(authStatus, 'loading projects.json…');
  try {
    const data = await ghGet(FILE_PATH);
    fileSha = data.sha;
    projects = JSON.parse(base64ToUtf8(data.content));
    projects.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    renderEditor();
    importPanel.hidden = false;
    projectsPanel.hidden = false;
    saveBar.hidden = false;
    setStatus(authStatus, `loaded ${projects.length} projects.`, 'ok');
  } catch (err) {
    setStatus(authStatus, 'failed to load: ' + err.message, 'err');
  }
});

clearTokenBtn.addEventListener('click', () => {
  clearToken();
  setStatus(authStatus, 'token forgotten from this browser.', 'ok');
});

// ---- import from github ----
importBtn.addEventListener('click', async () => {
  const raw = importUrl.value.trim();
  if (!raw) return;
  const match = raw.match(/github\.com\/([^\/]+)\/([^\/#]+)/i);
  if (!match) {
    setStatus(importStatus, 'paste a full github.com/owner/repo url.', 'err');
    return;
  }
  const [, owner, repoRaw] = match;
  const repo = repoRaw.replace(/\.git$/, '');
  setStatus(importStatus, `fetching ${owner}/${repo}…`);
  try {
    const info = await ghRepoInfo(owner, repo);
    const readme = await ghReadme(owner, repo);
    const title = info.name;
    const id = uniqueId(slugify(title));
    const project = {
      id,
      title,
      tags: info.language ? [info.language] : [],
      blurb: info.description || '',
      detail: info.description || '',
      repos: [{ label: 'repo', url: info.html_url }],
      featured: false,
      order: projects.length + 1
    };
    if (readme) readmeCache.set(id, readme);
    projects.push(project);
    renderEditor();
    setStatus(importStatus, readme
      ? `imported "${title}" with its README. Use "copy prompt for claude" on it below to draft the blurb and story.`
      : `imported "${title}" (no README found), fill in the blurb and story below.`, 'ok');
    importUrl.value = '';
    const block = editorEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (block) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    setStatus(importStatus, 'import failed: ' + err.message, 'err');
  }
});

// ---- add project manually ----
addProjectBtn.addEventListener('click', () => {
  const id = uniqueId('new-project');
  projects.push({
    id,
    title: 'New project',
    tags: [],
    blurb: '',
    detail: '',
    repos: [],
    featured: false,
    order: projects.length + 1
  });
  renderEditor();
  const block = editorEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
  if (block) block.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ---- editor rendering ----
function renderEditor() {
  editorEl.innerHTML = '';
  projects.forEach((project, index) => {
    editorEl.appendChild(buildProjectBlock(project, index));
  });
}

function buildProjectBlock(project, index) {
  const block = document.createElement('div');
  block.className = 'admin-project';
  block.dataset.id = project.id;

  // ---- head row: title, featured toggle, move/delete ----
  const head = document.createElement('div');
  head.className = 'admin-project-head';

  const titleInput = document.createElement('input');
  titleInput.className = 'admin-input';
  titleInput.value = project.title;
  titleInput.placeholder = 'project title';
  titleInput.addEventListener('input', () => { project.title = titleInput.value; });
  head.appendChild(titleInput);

  const featuredLabel = document.createElement('label');
  featuredLabel.className = 'admin-featured-toggle';
  const featuredCheckbox = document.createElement('input');
  featuredCheckbox.type = 'checkbox';
  featuredCheckbox.checked = !!project.featured;
  featuredCheckbox.addEventListener('change', () => { project.featured = featuredCheckbox.checked; });
  featuredLabel.appendChild(featuredCheckbox);
  featuredLabel.appendChild(document.createTextNode('featured'));
  head.appendChild(featuredLabel);

  const promptBtn = document.createElement('button');
  promptBtn.type = 'button';
  promptBtn.className = 'admin-icon-btn';
  promptBtn.textContent = 'copy prompt for claude';
  promptBtn.addEventListener('click', async () => {
    const readme = readmeCache.get(project.id) || '';
    const prompt = buildClaudePrompt(project, readme);
    try {
      await navigator.clipboard.writeText(prompt);
      promptBtn.textContent = 'copied ✓';
    } catch {
      promptBtn.textContent = 'copy failed';
    }
    setTimeout(() => { promptBtn.textContent = 'copy prompt for claude'; }, 1600);
  });
  head.appendChild(promptBtn);

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.className = 'admin-icon-btn';
  upBtn.textContent = '↑ up';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', () => {
    [projects[index - 1], projects[index]] = [projects[index], projects[index - 1]];
    renderEditor();
  });
  head.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'admin-icon-btn';
  downBtn.textContent = '↓ down';
  downBtn.disabled = index === projects.length - 1;
  downBtn.addEventListener('click', () => {
    [projects[index + 1], projects[index]] = [projects[index], projects[index + 1]];
    renderEditor();
  });
  head.appendChild(downBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'admin-icon-btn danger';
  deleteBtn.textContent = 'delete';
  deleteBtn.addEventListener('click', () => {
    if (!confirm(`Delete "${project.title}"? This only takes effect once you hit "save to github".`)) return;
    projects.splice(index, 1);
    renderEditor();
  });
  head.appendChild(deleteBtn);

  block.appendChild(head);

  // ---- tags ----
  const tagsField = document.createElement('div');
  tagsField.className = 'admin-field';
  const tagsLabel = document.createElement('label');
  tagsLabel.textContent = 'tags (comma separated)';
  tagsField.appendChild(tagsLabel);
  const tagsInput = document.createElement('input');
  tagsInput.className = 'admin-input';
  tagsInput.value = project.tags.join(', ');
  tagsInput.addEventListener('input', () => {
    project.tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
  });
  tagsField.appendChild(tagsInput);
  block.appendChild(tagsField);

  // ---- blurb ----
  const blurbField = document.createElement('div');
  blurbField.className = 'admin-field';
  const blurbLabel = document.createElement('label');
  blurbLabel.textContent = 'blurb (shown on the card/row)';
  blurbField.appendChild(blurbLabel);
  const blurbInput = document.createElement('textarea');
  blurbInput.className = 'admin-textarea';
  blurbInput.rows = 2;
  blurbInput.value = project.blurb;
  blurbInput.addEventListener('input', () => { project.blurb = blurbInput.value; });
  blurbField.appendChild(blurbInput);
  block.appendChild(blurbField);

  // ---- detail ----
  const detailField = document.createElement('div');
  detailField.className = 'admin-field';
  const detailLabel = document.createElement('label');
  detailLabel.textContent = 'story (shown in the tap-for-more modal)';
  detailField.appendChild(detailLabel);
  const detailInput = document.createElement('textarea');
  detailInput.className = 'admin-textarea';
  detailInput.rows = 4;
  detailInput.value = project.detail;
  detailInput.addEventListener('input', () => { project.detail = detailInput.value; });
  detailField.appendChild(detailInput);
  block.appendChild(detailField);

  // ---- repos ----
  const reposField = document.createElement('div');
  reposField.className = 'admin-field';
  const reposLabel = document.createElement('label');
  reposLabel.textContent = 'repo links (label + url, leave empty for none)';
  reposField.appendChild(reposLabel);

  const reposList = document.createElement('div');
  reposList.className = 'admin-repos';
  project.repos.forEach((repo, repoIndex) => {
    reposList.appendChild(buildRepoRow(project, repo, repoIndex, reposList));
  });
  reposField.appendChild(reposList);

  const addRepoBtn = document.createElement('button');
  addRepoBtn.type = 'button';
  addRepoBtn.className = 'admin-icon-btn';
  addRepoBtn.textContent = '+ add repo link';
  addRepoBtn.addEventListener('click', () => {
    project.repos.push({ label: 'repo', url: '' });
    reposList.appendChild(buildRepoRow(project, project.repos[project.repos.length - 1], project.repos.length - 1, reposList));
  });
  reposField.appendChild(addRepoBtn);

  block.appendChild(reposField);

  return block;
}

function buildRepoRow(project, repo, repoIndex, reposList) {
  const row = document.createElement('div');
  row.className = 'admin-repo-row';

  const labelInput = document.createElement('input');
  labelInput.className = 'admin-input';
  labelInput.placeholder = 'label, e.g. "repo"';
  labelInput.value = repo.label;
  labelInput.addEventListener('input', () => { repo.label = labelInput.value; });
  row.appendChild(labelInput);

  const urlInput = document.createElement('input');
  urlInput.className = 'admin-input url';
  urlInput.placeholder = 'https://github.com/...';
  urlInput.value = repo.url;
  urlInput.addEventListener('input', () => { repo.url = urlInput.value; });
  row.appendChild(urlInput);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'admin-icon-btn danger';
  removeBtn.textContent = 'remove';
  removeBtn.addEventListener('click', () => {
    const i = project.repos.indexOf(repo);
    if (i > -1) project.repos.splice(i, 1);
    row.remove();
  });
  row.appendChild(removeBtn);

  return row;
}

// ---- save ----
saveBtn.addEventListener('click', async () => {
  projects.forEach((p, i) => { p.order = i + 1; });
  const jsonStr = JSON.stringify(projects, null, 2) + '\n';
  setStatus(saveStatus, 'saving…');
  saveBtn.disabled = true;
  try {
    const result = await ghPut(FILE_PATH, jsonStr, 'update projects via admin panel', fileSha);
    fileSha = result.content.sha;
    setStatus(saveStatus, 'saved. GitHub Pages will pick it up on the live site in under a minute.', 'ok');
  } catch (err) {
    setStatus(saveStatus, 'save failed: ' + err.message, 'err');
  } finally {
    saveBtn.disabled = false;
  }
});
