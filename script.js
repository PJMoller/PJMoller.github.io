const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- Typing effect for hero ----
function typeInto(el, text, speed, done) {
  if (prefersReducedMotion) {
    el.textContent = text;
    if (done) done();
    return;
  }
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.textContent = ' ';
  let i = 0;
  el.textContent = '';
  el.appendChild(caret);
  const timer = setInterval(() => {
    if (i >= text.length) {
      clearInterval(timer);
      if (done) done();
      return;
    }
    caret.insertAdjacentText('beforebegin', text[i]);
    i++;
  }, speed);
}

const nameEl = document.getElementById('typed-name');
const taglineEl = document.getElementById('typed-tagline');

typeInto(nameEl, 'Peter Möller', 55, () => {
  typeInto(taglineEl, "I build things that think, move, and occasionally beat you at chess.", 18);
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
const modal = document.getElementById('modal');
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

// ---- Email button: copy to clipboard + attempt mailto ----
const emailBtn = document.getElementById('email-btn');
const emailHint = document.getElementById('email-hint');
if (emailBtn) {
  emailBtn.addEventListener('click', async () => {
    const email = emailBtn.dataset.email;
    let copied = false;
    try {
      await navigator.clipboard.writeText(email);
      copied = true;
    } catch (err) {
      copied = false;
    }
    emailHint.textContent = copied
      ? `Copied "${email}" to your clipboard — opening your mail app too.`
      : `My email is ${email} — opening your mail app now.`;
    window.location.href = `mailto:${email}`;
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
