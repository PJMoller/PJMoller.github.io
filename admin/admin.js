// ---- Admin panel ----
// Talks to a Cloudflare Worker (see /worker in the repo, deployed
// separately) instead of GitHub directly. The Worker holds the real
// password and the GitHub token as server-side secrets, neither one is
// ever present in this file or shipped to the browser. This file only
// ever sees a short-lived session token after a successful login.

const WORKER_URL = 'https://pjmoller-admin.peetmoller92.workers.dev';

const SESSION_KEY = 'pjmoller_admin_session';

let projects = [];
let fileSha = null;
const readmeCache = new Map(); // project id -> readme text, never saved to projects.json

const lockPanel = document.getElementById('lock-panel');
const adminContent = document.getElementById('admin-content');
const lockBtn = document.getElementById('lock-btn'); // inside #admin-content, so it hides/shows with it
const gateInput = document.getElementById('gate-password-input');
const gateBtn = document.getElementById('gate-unlock-btn');
const gateStatus = document.getElementById('gate-status');

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

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = 'admin-status' + (kind ? ' ' + kind : '');
}

// ---- session ----
function getSession() {
  return localStorage.getItem(SESSION_KEY) || '';
}
function setSession(token) {
  localStorage.setItem(SESSION_KEY, token);
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function showUnlocked() {
  lockPanel.hidden = true;
  adminContent.hidden = false;
}
function showLocked() {
  clearSession();
  lockPanel.hidden = false;
  adminContent.hidden = true;
  gateInput.value = '';
  importPanel.hidden = true;
  projectsPanel.hidden = true;
  saveBar.hidden = true;
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

// ---- Worker API ----
async function workerFetch(path, options = {}) {
  if (!WORKER_URL) throw new Error('WORKER_URL is not set in admin.js yet.');
  const session = getSession();
  const res = await fetch(WORKER_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: 'Bearer ' + session } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    showLocked();
    setStatus(gateStatus, 'session expired, log in again.', 'err');
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `worker returned ${res.status}`);
  return data;
}

async function login(password) {
  const res = await fetch(WORKER_URL + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'login failed');
  return data.token;
}

async function loadProjects() {
  const data = await workerFetch('/projects');
  fileSha = data.sha;
  projects = JSON.parse(base64ToUtf8(data.content));
  projects.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function saveProjects() {
  projects.forEach((p, i) => { p.order = i + 1; });
  // strip internal-only UI state (e.g. which entries are expanded) before saving
  const clean = projects.map(({ _open, ...rest }) => rest);
  const jsonStr = JSON.stringify(clean, null, 2) + '\n';
  const data = await workerFetch('/projects', {
    method: 'PUT',
    body: JSON.stringify({ content: utf8ToBase64(jsonStr), sha: fileSha }),
  });
  fileSha = data.content.sha;
}

async function importFromGithub(repoUrl) {
  return workerFetch('/import?url=' + encodeURIComponent(repoUrl));
}

// ---- login flow ----
if (WORKER_URL && getSession()) {
  showUnlocked();
  loadProjects()
    .then(() => {
      renderEditor();
      importPanel.hidden = false;
      projectsPanel.hidden = false;
      saveBar.hidden = false;
    })
    .catch((err) => {
      if (err.message !== 'unauthorized') setStatus(gateStatus, 'failed to load: ' + err.message, 'err');
    });
}

gateBtn.addEventListener('click', async () => {
  if (!WORKER_URL) {
    setStatus(gateStatus, 'admin.js has no WORKER_URL set yet, deploy the Worker first.', 'err');
    return;
  }
  setStatus(gateStatus, 'checking…');
  try {
    const token = await login(gateInput.value);
    setSession(token);
    showUnlocked();
    setStatus(gateStatus, 'loading projects…');
    await loadProjects();
    renderEditor();
    importPanel.hidden = false;
    projectsPanel.hidden = false;
    saveBar.hidden = false;
    setStatus(gateStatus, `loaded ${projects.length} projects.`, 'ok');
  } catch (err) {
    setStatus(gateStatus, err.message === 'wrong password' ? 'wrong password.' : err.message, 'err');
  }
});
gateInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') gateBtn.click();
});
lockBtn.addEventListener('click', showLocked);

// ---- helpers ----
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
}
function uniqueId(base) {
  let id = base;
  let n = 2;
  const existing = new Set(projects.map((p) => p.id));
  while (existing.has(id)) { id = `${base}-${n}`; n++; }
  return id;
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

// ---- import from github ----
importBtn.addEventListener('click', async () => {
  const raw = importUrl.value.trim();
  if (!raw) return;
  setStatus(importStatus, 'fetching…');
  try {
    const { info, readme } = await importFromGithub(raw);
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
      order: projects.length + 1,
      _open: true,
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
    order: projects.length + 1,
    _open: true,
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
  const block = document.createElement('details');
  block.className = 'admin-project';
  block.dataset.id = project.id;
  if (project._open) block.open = true;
  block.addEventListener('toggle', () => { project._open = block.open; });

  // ---- collapsed summary row ----
  const summary = document.createElement('summary');
  summary.className = 'admin-project-summary';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'admin-project-name';
  nameSpan.textContent = project.title || 'untitled project';
  summary.appendChild(nameSpan);

  const badge = document.createElement('span');
  badge.className = 'admin-badge';
  badge.textContent = 'featured';
  badge.hidden = !project.featured;
  summary.appendChild(badge);

  const controls = document.createElement('span');
  controls.className = 'admin-project-controls';

  const upBtn = document.createElement('button');
  upBtn.type = 'button';
  upBtn.className = 'admin-icon-btn';
  upBtn.title = 'move up';
  upBtn.textContent = '↑';
  upBtn.disabled = index === 0;
  upBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    [projects[index - 1], projects[index]] = [projects[index], projects[index - 1]];
    renderEditor();
  });
  controls.appendChild(upBtn);

  const downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'admin-icon-btn';
  downBtn.title = 'move down';
  downBtn.textContent = '↓';
  downBtn.disabled = index === projects.length - 1;
  downBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    [projects[index + 1], projects[index]] = [projects[index], projects[index + 1]];
    renderEditor();
  });
  controls.appendChild(downBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'admin-icon-btn danger';
  deleteBtn.title = 'delete';
  deleteBtn.textContent = '×';
  deleteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${project.title}"? This only takes effect once you hit "save to github".`)) return;
    projects.splice(index, 1);
    renderEditor();
  });
  controls.appendChild(deleteBtn);

  summary.appendChild(controls);
  block.appendChild(summary);

  // ---- expanded body ----
  const body = document.createElement('div');
  body.className = 'admin-project-body';

  const metaRow = document.createElement('div');
  metaRow.className = 'admin-row admin-project-meta';

  const titleInput = document.createElement('input');
  titleInput.className = 'admin-input';
  titleInput.value = project.title;
  titleInput.placeholder = 'project title';
  titleInput.addEventListener('input', () => {
    project.title = titleInput.value;
    nameSpan.textContent = titleInput.value || 'untitled project';
  });
  metaRow.appendChild(titleInput);

  const featuredLabel = document.createElement('label');
  featuredLabel.className = 'admin-featured-toggle';
  const featuredCheckbox = document.createElement('input');
  featuredCheckbox.type = 'checkbox';
  featuredCheckbox.checked = !!project.featured;
  featuredCheckbox.addEventListener('change', () => {
    project.featured = featuredCheckbox.checked;
    badge.hidden = !project.featured;
  });
  featuredLabel.appendChild(featuredCheckbox);
  featuredLabel.appendChild(document.createTextNode('featured'));
  metaRow.appendChild(featuredLabel);

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
  metaRow.appendChild(promptBtn);

  body.appendChild(metaRow);

  // ---- tags ----
  const tagsField = document.createElement('div');
  tagsField.className = 'admin-field';
  const tagsLabel = document.createElement('label');
  tagsLabel.textContent = 'tags';
  tagsField.appendChild(tagsLabel);
  const tagsInput = document.createElement('input');
  tagsInput.className = 'admin-input';
  tagsInput.placeholder = 'comma separated, e.g. Python, Flask';
  tagsInput.value = project.tags.join(', ');
  tagsInput.addEventListener('input', () => {
    project.tags = tagsInput.value.split(',').map((t) => t.trim()).filter(Boolean);
  });
  tagsField.appendChild(tagsInput);
  body.appendChild(tagsField);

  // ---- blurb ----
  const blurbField = document.createElement('div');
  blurbField.className = 'admin-field';
  const blurbLabel = document.createElement('label');
  blurbLabel.textContent = 'blurb';
  blurbField.appendChild(blurbLabel);
  const blurbInput = document.createElement('textarea');
  blurbInput.className = 'admin-textarea';
  blurbInput.rows = 2;
  blurbInput.placeholder = 'shown on the project card';
  blurbInput.value = project.blurb;
  blurbInput.addEventListener('input', () => { project.blurb = blurbInput.value; });
  blurbField.appendChild(blurbInput);
  body.appendChild(blurbField);

  // ---- detail ----
  const detailField = document.createElement('div');
  detailField.className = 'admin-field';
  const detailLabel = document.createElement('label');
  detailLabel.textContent = 'story';
  detailField.appendChild(detailLabel);
  const detailInput = document.createElement('textarea');
  detailInput.className = 'admin-textarea';
  detailInput.rows = 4;
  detailInput.placeholder = 'shown in the tap-for-more popup';
  detailInput.value = project.detail;
  detailInput.addEventListener('input', () => { project.detail = detailInput.value; });
  detailField.appendChild(detailInput);
  body.appendChild(detailField);

  // ---- repos ----
  const reposField = document.createElement('div');
  reposField.className = 'admin-field';
  const reposLabel = document.createElement('label');
  reposLabel.textContent = 'repos';
  reposField.appendChild(reposLabel);

  const reposList = document.createElement('div');
  reposList.className = 'admin-repos';
  project.repos.forEach((repo, repoIndex) => {
    reposList.appendChild(buildRepoRow(project, repo, repoIndex));
  });
  reposField.appendChild(reposList);

  const addRepoBtn = document.createElement('button');
  addRepoBtn.type = 'button';
  addRepoBtn.className = 'admin-icon-btn';
  addRepoBtn.textContent = '+ repo';
  addRepoBtn.addEventListener('click', () => {
    project.repos.push({ label: 'repo', url: '' });
    reposList.appendChild(buildRepoRow(project, project.repos[project.repos.length - 1], project.repos.length - 1));
  });
  reposField.appendChild(addRepoBtn);

  body.appendChild(reposField);
  block.appendChild(body);

  return block;
}

function buildRepoRow(project, repo) {
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
  setStatus(saveStatus, 'saving…');
  saveBtn.disabled = true;
  try {
    await saveProjects();
    setStatus(saveStatus, 'saved. GitHub Pages will pick it up on the live site in under a minute.', 'ok');
  } catch (err) {
    setStatus(saveStatus, 'save failed: ' + err.message, 'err');
  } finally {
    saveBtn.disabled = false;
  }
});
