const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hero tagline typing is a pure CSS animation (see style.css) so it never
// depends on a JS timer — the real text is in the HTML from the start,
// and CSS just reveals it.

// ---- Reveal sections on scroll ----
const sections = document.querySelectorAll('.section');
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      sectionObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
sections.forEach(s => sectionObserver.observe(s));

// ---- Active nav link highlighting ----
const navLinks = document.querySelectorAll('.nav-links a');
const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    const link = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
    if (!link) return;
    if (entry.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
}, { rootMargin: '-40% 0px -50% 0px' });
document.querySelectorAll('main .section[id]').forEach(s => navObserver.observe(s));

// ---- Project card modal ----
const overlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
let lastFocused = null;

function openModal(card) {
  lastFocused = document.activeElement;
  modalTitle.textContent = card.querySelector('h3').textContent;
  modalBody.textContent = card.dataset.detail;
  overlay.classList.add('open');
  modalClose.focus();
}

function closeModal() {
  overlay.classList.remove('open');
  if (lastFocused) lastFocused.focus();
}

document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('click', () => openModal(card));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openModal(card);
    }
  });
});

modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
});

// ---- Email button ----
// This is a real `<a href="mailto:...">` so the browser handles opening
// the mail client itself, synchronously, as part of the click — no JS
// in the way. We just piggyback a clipboard copy on the same click
// (without awaiting before letting the link do its thing, since an
// `await` before a navigation can cause browsers to silently drop it).
const emailBtn = document.getElementById('email-btn');
const emailHint = document.getElementById('email-hint');
if (emailBtn) {
  emailBtn.addEventListener('click', () => {
    const email = emailBtn.dataset.email;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email)
        .then(() => {
          emailHint.textContent = `Copied "${email}" to your clipboard.`;
        })
        .catch(() => {
          emailHint.textContent = `My email is ${email}.`;
        });
    } else {
      emailHint.textContent = `My email is ${email}.`;
    }
  });
}

// ---- Circuit-board background animation ----
const canvas = document.getElementById('circuit-bg');
const ctx = canvas.getContext('2d');
let w, h, nodes;
const NODE_COUNT = 55;
const LINK_DIST = 130;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function initNodes() {
  nodes = Array.from({ length: NODE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3
  }));
}
initNodes();

const mouse = { x: -9999, y: -9999 };
window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener('mouseleave', () => {
  mouse.x = -9999;
  mouse.y = -9999;
});

function tick() {
  ctx.clearRect(0, 0, w, h);

  nodes.forEach(n => {
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < 0 || n.x > w) n.vx *= -1;
    if (n.y < 0 || n.y > h) n.vy *= -1;
  });

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < LINK_DIST) {
        ctx.strokeStyle = `rgba(57, 255, 136, ${0.12 * (1 - dist / LINK_DIST)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    const dxm = nodes[i].x - mouse.x, dym = nodes[i].y - mouse.y;
    const distM = Math.sqrt(dxm * dxm + dym * dym);
    if (distM < 160) {
      ctx.strokeStyle = `rgba(88, 166, 255, ${0.25 * (1 - distM / 160)})`;
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
  }

  nodes.forEach(n => {
    ctx.fillStyle = 'rgba(57, 255, 136, 0.6)';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(tick);
}
if (!prefersReducedMotion) {
  tick();
} else {
  canvas.style.display = 'none';
}

// ---- Debug Dash: tiny dodge-the-bugs game ----
(function () {
  const gc = document.getElementById('game-canvas');
  if (!gc) return;
  const gctx = gc.getContext('2d');
  const GW = gc.width;
  const GH = gc.height;

  const overlayEl = document.getElementById('game-overlay');
  const overlayTitle = document.getElementById('game-overlay-title');
  const overlaySub = document.getElementById('game-overlay-sub');
  const startBtn = document.getElementById('game-btn');
  const leftBtn = document.getElementById('game-left');
  const rightBtn = document.getElementById('game-right');

  const PLAYER_W = 34, PLAYER_H = 22;
  let player, bugs, score, speedMul, spawnTimer, spawnEvery, state, lastTime, movingLeft, movingRight;

  function reset() {
    player = { x: GW / 2 - PLAYER_W / 2, y: GH - PLAYER_H - 14, w: PLAYER_W, h: PLAYER_H, vx: 0 };
    bugs = [];
    score = 0;
    speedMul = 1;
    spawnTimer = 0;
    spawnEvery = 900;
    state = 'playing';
    lastTime = performance.now();
    movingLeft = false;
    movingRight = false;
  }

  function spawnBug() {
    const size = 14 + Math.random() * 10;
    bugs.push({
      x: Math.random() * (GW - size),
      y: -size,
      w: size,
      h: size,
      vy: (60 + Math.random() * 40) * speedMul
    });
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function drawPlayer() {
    gctx.fillStyle = '#39ff88';
    gctx.fillRect(player.x, player.y, player.w, player.h);
    gctx.fillStyle = '#0d1117';
    gctx.font = '12px monospace';
    gctx.textAlign = 'center';
    gctx.fillText('</>', player.x + player.w / 2, player.y + player.h / 2 + 4);
  }

  function drawBug(b) {
    gctx.fillStyle = '#ff5f56';
    gctx.beginPath();
    gctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2.4, 0, 0, Math.PI * 2);
    gctx.fill();
    gctx.strokeStyle = 'rgba(255,255,255,0.4)';
    gctx.lineWidth = 1;
    gctx.beginPath();
    gctx.moveTo(b.x, b.y + b.h / 2);
    gctx.lineTo(b.x + b.w, b.y + b.h / 2);
    gctx.stroke();
  }

  function drawScore() {
    gctx.fillStyle = 'rgba(201,209,217,0.85)';
    gctx.font = '13px monospace';
    gctx.textAlign = 'left';
    gctx.fillText('score: ' + Math.floor(score), 10, 20);
  }

  function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    gctx.clearRect(0, 0, GW, GH);

    const speed = 220;
    if (movingLeft) player.x -= speed * (dt / 1000);
    if (movingRight) player.x += speed * (dt / 1000);
    player.x = Math.max(0, Math.min(GW - player.w, player.x));

    spawnTimer += dt;
    if (spawnTimer >= spawnEvery) {
      spawnTimer = 0;
      spawnBug();
      spawnEvery = Math.max(280, spawnEvery - 12);
    }

    speedMul = 1 + score / 4000;
    score += dt / 16;

    for (let i = bugs.length - 1; i >= 0; i--) {
      const b = bugs[i];
      b.y += b.vy * (dt / 1000);
      if (b.y > GH) {
        bugs.splice(i, 1);
        continue;
      }
      if (rectsOverlap(player, b)) {
        gameOver();
        return;
      }
      drawBug(b);
    }

    drawPlayer();
    drawScore();

    requestAnimationFrame(loop);
  }

  function gameOver() {
    state = 'gameover';
    overlayTitle.textContent = 'busted';
    overlaySub.textContent = `You survived a score of ${Math.floor(score)}. Try again?`;
    startBtn.textContent = 'play again';
    overlayEl.classList.remove('hidden');
  }

  function startGame() {
    reset();
    overlayEl.classList.add('hidden');
    requestAnimationFrame(loop);
  }

  startBtn.addEventListener('click', startGame);

  document.addEventListener('keydown', (e) => {
    if (state !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      movingLeft = true;
      e.preventDefault();
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      movingRight = true;
      e.preventDefault();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') movingLeft = false;
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') movingRight = false;
  });

  function bindHold(btn, setter) {
    const start = (e) => { e.preventDefault(); setter(true); };
    const end = () => setter(false);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
    btn.addEventListener('touchend', end);
  }
  bindHold(leftBtn, (v) => { movingLeft = v; });
  bindHold(rightBtn, (v) => { movingRight = v; });

  // initial idle frame
  gctx.clearRect(0, 0, GW, GH);
})();
