const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hero tagline typing is a pure CSS animation (see css/style.css) so it
// never depends on a JS timer, the real text is in the HTML from the
// start and CSS just reveals it.

// ---- In-page nav links: scroll to the section without writing a #hash
// into the URL bar (so the address bar stays clean on every click). ----
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  });
});

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
  const titleEl = card.querySelector('h3');
  modalTitle.textContent = card.dataset.title || (titleEl ? titleEl.textContent : '');
  modalBody.textContent = card.dataset.detail;
  overlay.classList.add('open');
  modalClose.focus();
}

function closeModal() {
  overlay.classList.remove('open');
  if (lastFocused) lastFocused.focus();
}

document.querySelectorAll('.project-card, .project-row').forEach(card => {
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
// the mail client itself, synchronously, as part of the click, no JS in
// the way. We just piggyback a clipboard copy on the same click without
// awaiting before letting the link do its thing, since an `await` before
// a navigation can cause browsers to silently drop it.
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

// ---- Fly Catcher: a tiny frog game ----
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

  const FROG_W = 36, FROG_H = 24;
  let frog, items, score, speedMul, spawnTimer, spawnEvery, state, lastTime, movingLeft, movingRight, tongueFrame;

  function reset() {
    frog = { x: GW / 2 - FROG_W / 2, y: GH - FROG_H - 14, w: FROG_W, h: FROG_H };
    items = [];
    score = 0;
    speedMul = 1;
    spawnTimer = 0;
    spawnEvery = 700;
    state = 'playing';
    lastTime = performance.now();
    movingLeft = false;
    movingRight = false;
    tongueFrame = 0;
  }

  function spawnItem() {
    const isBee = Math.random() < 0.3;
    const size = isBee ? 16 : 12;
    items.push({
      type: isBee ? 'bee' : 'fly',
      x: Math.random() * (GW - size),
      y: -size,
      w: size,
      h: size,
      vy: (70 + Math.random() * 50) * speedMul,
      wob: Math.random() * Math.PI * 2
    });
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function drawFrog() {
    gctx.fillStyle = '#39ff88';
    gctx.beginPath();
    gctx.ellipse(frog.x + frog.w / 2, frog.y + frog.h / 2 + 4, frog.w / 2, frog.h / 2, 0, 0, Math.PI * 2);
    gctx.fill();
    // eyes
    gctx.fillStyle = '#0d1117';
    gctx.beginPath();
    gctx.arc(frog.x + frog.w * 0.32, frog.y + 6, 3, 0, Math.PI * 2);
    gctx.arc(frog.x + frog.w * 0.68, frog.y + 6, 3, 0, Math.PI * 2);
    gctx.fill();
    if (tongueFrame > 0) {
      gctx.strokeStyle = '#ff5f56';
      gctx.lineWidth = 3;
      gctx.beginPath();
      gctx.moveTo(frog.x + frog.w / 2, frog.y + 4);
      gctx.lineTo(frog.x + frog.w / 2, frog.y - 14);
      gctx.stroke();
      tongueFrame--;
    }
  }

  function drawFly(it) {
    gctx.fillStyle = '#1f2530';
    gctx.beginPath();
    gctx.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2, 0, 0, Math.PI * 2);
    gctx.fill();
    gctx.fillStyle = 'rgba(88,166,255,0.5)';
    const wob = Math.sin(it.wob) * 3;
    gctx.beginPath();
    gctx.ellipse(it.x + it.w / 2 - 4, it.y + it.h / 2 - 4 + wob, 4, 2, 0.4, 0, Math.PI * 2);
    gctx.ellipse(it.x + it.w / 2 + 4, it.y + it.h / 2 - 4 - wob, 4, 2, -0.4, 0, Math.PI * 2);
    gctx.fill();
  }

  function drawBee(it) {
    gctx.fillStyle = '#ffbd2e';
    gctx.beginPath();
    gctx.ellipse(it.x + it.w / 2, it.y + it.h / 2, it.w / 2, it.h / 2.4, 0, 0, Math.PI * 2);
    gctx.fill();
    gctx.strokeStyle = '#0d1117';
    gctx.lineWidth = 2;
    gctx.beginPath();
    gctx.moveTo(it.x + it.w * 0.3, it.y);
    gctx.lineTo(it.x + it.w * 0.3, it.y + it.h);
    gctx.moveTo(it.x + it.w * 0.6, it.y);
    gctx.lineTo(it.x + it.w * 0.6, it.y + it.h);
    gctx.stroke();
  }

  function drawScore() {
    gctx.fillStyle = 'rgba(201,209,217,0.85)';
    gctx.font = '13px monospace';
    gctx.textAlign = 'left';
    gctx.fillText('flies caught: ' + score, 10, 20);
  }

  function loop(now) {
    if (state !== 'playing') return;
    const dt = Math.min(50, now - lastTime);
    lastTime = now;

    gctx.clearRect(0, 0, GW, GH);

    const speed = 240;
    if (movingLeft) frog.x -= speed * (dt / 1000);
    if (movingRight) frog.x += speed * (dt / 1000);
    frog.x = Math.max(0, Math.min(GW - frog.w, frog.x));

    spawnTimer += dt;
    if (spawnTimer >= spawnEvery) {
      spawnTimer = 0;
      spawnItem();
      spawnEvery = Math.max(320, spawnEvery - 10);
    }

    speedMul = 1 + score / 30;

    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.y += it.vy * (dt / 1000);
      it.wob += dt / 120;
      if (it.y > GH) {
        items.splice(i, 1);
        continue;
      }
      if (rectsOverlap(frog, it)) {
        if (it.type === 'fly') {
          score++;
          tongueFrame = 6;
          items.splice(i, 1);
          continue;
        } else {
          gameOver();
          return;
        }
      }
      if (it.type === 'fly') drawFly(it); else drawBee(it);
    }

    drawFrog();
    drawScore();

    requestAnimationFrame(loop);
  }

  function gameOver() {
    state = 'gameover';
    overlayTitle.textContent = 'stung!';
    overlaySub.textContent = `You caught ${score} flies before a bee got you. Try again?`;
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

  gctx.clearRect(0, 0, GW, GH);
})();
