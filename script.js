// ---- Reveal sections on scroll ----
const sections = document.querySelectorAll('.section');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
sections.forEach(s => observer.observe(s));

// ---- Project card modal ----
const overlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

document.querySelectorAll('.project-card').forEach(card => {
  card.addEventListener('click', () => {
    modalTitle.textContent = card.querySelector('h3').textContent;
    modalBody.textContent = card.dataset.detail;
    overlay.classList.add('open');
  });
});

function closeModal() {
  overlay.classList.remove('open');
}
modalClose.addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => {
  if (e.target === overlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ---- Circuit-board background animation ----
const canvas = document.getElementById('circuit-bg');
const ctx = canvas.getContext('2d');
let w, h, nodes;
const NODE_COUNT = 60;
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
        ctx.strokeStyle = `rgba(94, 230, 200, ${0.12 * (1 - dist / LINK_DIST)})`;
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
      ctx.strokeStyle = `rgba(255, 138, 91, ${0.25 * (1 - distM / 160)})`;
      ctx.beginPath();
      ctx.moveTo(nodes[i].x, nodes[i].y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
  }

  nodes.forEach(n => {
    ctx.fillStyle = 'rgba(94, 230, 200, 0.6)';
    ctx.beginPath();
    ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });

  requestAnimationFrame(tick);
}
tick();
