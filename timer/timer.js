// ---- Countdown timer ----
// Once started there is no pause, reset or cancel control. The timer is
// stored as an absolute end timestamp in localStorage, so it keeps counting
// through reloads and closed tabs: the remaining time is always derived from
// the clock, never from a counter that could stop when the page does.

const STORAGE_KEY = 'pm-timer';
const MAX_SECONDS = 99 * 3600 + 59 * 60 + 59;

const setupPanel = document.getElementById('setup-panel');
const runningPanel = document.getElementById('running-panel');
const donePanel = document.getElementById('done-panel');
const inH = document.getElementById('in-h');
const inM = document.getElementById('in-m');
const inS = document.getElementById('in-s');
const startBtn = document.getElementById('start-btn');
const againBtn = document.getElementById('again-btn');
const setupStatus = document.getElementById('setup-status');
const display = document.getElementById('display');
const barFill = document.getElementById('bar-fill');
const meta = document.getElementById('meta');

let tickHandle = null;
let wakeLock = null;

// ---- storage (wrapped, localStorage can throw in some contexts) ----
function loadTimer() {
  try {
    const t = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (t && typeof t.endAt === 'number' && typeof t.total === 'number') return t;
  } catch {}
  return null;
}
function saveTimer(t) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(t)); } catch {}
}
function clearTimer() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ---- formatting ----
const pad = (n) => String(n).padStart(2, '0');
function formatHMS(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function showPanel(which) {
  setupPanel.hidden = which !== 'setup';
  runningPanel.hidden = which !== 'running';
  donePanel.hidden = which !== 'done';
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

startBtn.addEventListener('click', () => {
  const seconds = readSeconds();
  if (seconds <= 0) {
    setupStatus.textContent = 'pick a duration first.';
    return;
  }
  if (seconds > MAX_SECONDS) {
    setupStatus.textContent = 'max is 99:59:59.';
    return;
  }
  const ok = window.confirm(`Start a ${formatHMS(seconds)} timer? It can't be stopped once it starts.`);
  if (!ok) return;

  setupStatus.textContent = '';
  const now = Date.now();
  saveTimer({ startedAt: now, endAt: now + seconds * 1000, total: seconds });
  enter();
});

againBtn.addEventListener('click', () => {
  clearTimer();
  enter();
});

// ---- running ----
function remainingSeconds(t) {
  return Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000));
}

function tick() {
  const t = loadTimer();
  if (!t) { enter(); return; }
  const left = remainingSeconds(t);
  if (left <= 0) { finish(t); return; }

  display.textContent = formatHMS(left);
  document.title = `${formatHMS(left)} · timer`;
  barFill.style.width = `${((t.total - left) / t.total) * 100}%`;
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch {}
}

function startRunning(t) {
  showPanel('running');
  const end = new Date(t.endAt);
  meta.textContent = `ends at ${pad(end.getHours())}:${pad(end.getMinutes())}:${pad(end.getSeconds())}`;
  tick();
  clearInterval(tickHandle);
  tickHandle = setInterval(tick, 250);
  requestWakeLock();
}

// ---- finish ----
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

function finish(t) {
  clearInterval(tickHandle);
  tickHandle = null;
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  document.title = "time's up · timer";
  showPanel('done');
  // beep only if the timer finished while the page was open, not on a late reload
  if (Date.now() - t.endAt < 5000 && !t.notified) {
    saveTimer({ ...t, notified: true });
    beep();
  }
}

// ---- entry point: decide which panel to show ----
function enter() {
  clearInterval(tickHandle);
  const t = loadTimer();
  if (!t) {
    document.title = 'timer · Peter Möller';
    showPanel('setup');
    return;
  }
  if (remainingSeconds(t) <= 0) {
    finish(t);
    return;
  }
  startRunning(t);
}

// closing or reloading mid-countdown gets a warning, the timer itself keeps going either way
window.addEventListener('beforeunload', (e) => {
  const t = loadTimer();
  if (t && remainingSeconds(t) > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// wake lock is dropped when the tab is hidden, take it back on return
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && loadTimer() && remainingSeconds(loadTimer()) > 0) {
    requestWakeLock();
  }
});

// another tab started or finished a timer
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) enter();
});

enter();
