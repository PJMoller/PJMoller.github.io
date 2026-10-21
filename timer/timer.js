// ---- Shared countdown timer ----
// The timer lives on the server (timer.json, via the Cloudflare Worker), so
// every visitor sees the same countdown. Anyone can watch it; starting one
// needs the admin password. Once started there is no pause, reset or cancel,
// and the Worker refuses a new timer while one is still running.
//
// The end time is an absolute timestamp set from the Worker's clock. The
// page measures how far its own clock is from the server's and corrects for
// it, then re-syncs periodically.

const WORKER_URL = 'https://pjmoller-admin.peetmoller92.workers.dev';
const MAX_SECONDS = 99 * 3600 + 59 * 60 + 59;
const RESYNC_MS = 30000;

const setupPanel = document.getElementById('setup-panel');
const runningPanel = document.getElementById('running-panel');
const donePanel = document.getElementById('done-panel');
const loadingPanel = document.getElementById('loading-panel');
const inH = document.getElementById('in-h');
const inM = document.getElementById('in-m');
const inS = document.getElementById('in-s');
const inPass = document.getElementById('in-pass');
const startBtn = document.getElementById('start-btn');
const againBtn = document.getElementById('again-btn');
const setupStatus = document.getElementById('setup-status');
const loadingText = document.getElementById('loading-text');
const display = document.getElementById('display');
const barFill = document.getElementById('bar-fill');
const meta = document.getElementById('meta');

let timer = null;        // { startedAt, endAt, total } from the server, or null
let clockOffset = 0;     // server time minus local time, in ms
let tickHandle = null;
let wakeLock = null;
let wasRunning = false;  // true once this page has seen the timer running
let showSetup = false;   // the "new timer" button on the finished screen

const pad = (n) => String(n).padStart(2, '0');
function formatHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const serverNow = () => Date.now() + clockOffset;
const remainingSeconds = () => (timer ? Math.max(0, Math.ceil((timer.endAt - serverNow()) / 1000)) : 0);

function showPanel(which) {
  loadingPanel.hidden = which !== 'loading';
  setupPanel.hidden = which !== 'setup';
  runningPanel.hidden = which !== 'running';
  donePanel.hidden = which !== 'done';
}

// ---- server ----
function applyServerState(body) {
  clockOffset = body.now - Date.now();
  timer = body.timer && typeof body.timer.endAt === 'number' ? body.timer : null;
}

async function sync() {
  const res = await fetch(WORKER_URL + '/timer', { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `worker returned ${res.status}`);
  applyServerState(body);
}

async function startTimer(password, seconds) {
  const loginRes = await fetch(WORKER_URL + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok) throw new Error(loginBody.error || 'login failed');

  const res = await fetch(WORKER_URL + '/timer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + loginBody.token,
    },
    body: JSON.stringify({ seconds }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409 && body.timer) {
    applyServerState(body);
    return;
  }
  if (!res.ok) throw new Error(body.error || `worker returned ${res.status}`);
  applyServerState(body);
}

// ---- setup ----
function readSeconds() {
  const h = Math.max(0, parseInt(inH.value, 10) || 0);
  const m = Math.max(0, parseInt(inM.value, 10) || 0);
  const s = Math.max(0, parseInt(inS.value, 10) || 0);
  return h * 3600 + m * 60 + s;
}

function fillInputs(seconds) {
  inH.value = Math.floor(seconds / 3600);
  inM.value = Math.floor((seconds % 3600) / 60);
  inS.value = seconds % 60;
}

document.querySelectorAll('.timer-preset').forEach((btn) => {
  btn.addEventListener('click', () => fillInputs(parseInt(btn.dataset.seconds, 10)));
});

startBtn.addEventListener('click', async () => {
  const seconds = readSeconds();
  if (seconds <= 0) { setupStatus.textContent = 'pick a duration first.'; return; }
  if (seconds > MAX_SECONDS) { setupStatus.textContent = 'max is 99:59:59.'; return; }
  if (!inPass.value) { setupStatus.textContent = 'password needed to start.'; return; }
  if (!window.confirm(`Start a ${formatHMS(seconds)} timer for everyone? It can't be stopped once it starts.`)) return;

  setupStatus.textContent = 'starting…';
  startBtn.disabled = true;
  try {
    await startTimer(inPass.value, seconds);
    inPass.value = '';
    setupStatus.textContent = '';
    showSetup = false;
    render();
  } catch (err) {
    setupStatus.textContent = err.message;
  } finally {
    startBtn.disabled = false;
  }
});

againBtn.addEventListener('click', () => {
  showSetup = true;
  render();
});

// ---- running ----
function tick() {
  const left = remainingSeconds();
  if (left <= 0) { render(); return; }
  display.textContent = formatHMS(left);
  document.title = `${formatHMS(left)} · timer`;
  barFill.style.width = `${((timer.total - left) / timer.total) * 100}%`;
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch {}
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.4);
      osc.stop(ctx.currentTime + i * 0.4 + 0.2);
    }
  } catch {}
}

// ---- decide which panel to show from the current state ----
function render() {
  clearInterval(tickHandle);
  tickHandle = null;

  if (timer && remainingSeconds() > 0) {
    wasRunning = true;
    showPanel('running');
    const end = new Date(timer.endAt);
    meta.textContent = `ends at ${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`;
    tick();
    tickHandle = setInterval(tick, 250);
    requestWakeLock();
    return;
  }

  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }

  // a timer that has already ended: show the finished screen unless the
  // visitor asked for a new one
  if (timer && !showSetup) {
    document.title = "time's up · timer";
    showPanel('done');
    if (wasRunning) { wasRunning = false; beep(); }
    return;
  }

  document.title = 'timer · Peter Möller';
  showPanel('setup');
}

// closing or reloading mid-countdown gets a warning, the countdown itself keeps going either way
window.addEventListener('beforeunload', (e) => {
  if (timer && remainingSeconds() > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// wake lock is dropped when the tab is hidden, re-sync and take it back on return
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  sync().then(render).catch(() => {});
});

// pick up a timer started from another device, and keep the clock offset fresh
setInterval(() => { sync().then(render).catch(() => {}); }, RESYNC_MS);

sync()
  .then(render)
  .catch((err) => {
    loadingText.textContent = 'failed to load: ' + err.message;
  });
