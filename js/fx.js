// Visual effects: particle canvas (corn, feathers, confetti, sparks, dust), flying DOM items,
// rubber stamps, screen shake. All promise-based so the game can sequence animations.

const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let canvas, ctx, dpr = 1, W = 0, H = 0, raf = 0;
const parts = [];
let layer;

export const fx = {
  speed: 1,
  init(c) {
    canvas = c;
    ctx = c.getContext('2d');
    layer = document.createElement('div');
    layer.className = 'fly-layer';
    document.body.appendChild(layer);
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    };
    resize();
    addEventListener('resize', resize);
  },
  wait(ms) { return new Promise((r) => setTimeout(r, ms / fx.speed)); },
  center(target) {
    if (!target) return { x: W / 2, y: H / 2 };
    if (typeof target.x === 'number') return target;
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  },

  /* ---------- particles ---------- */
  burst(at, { type = 'spark', count = 18, colors, power = 1, spread = Math.PI * 2, angle = -Math.PI / 2, gravity } = {}) {
    if (reduce) count = Math.ceil(count / 4);
    const { x, y } = fx.center(at);
    for (let i = 0; i < count; i++) {
      const a = spread >= Math.PI * 2 ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * spread;
      const sp = (type === 'feather' ? 2.2 : type === 'dust' ? 1.4 : 4.5) * power * (0.5 + Math.random());
      parts.push(makePart(type, x, y, Math.cos(a) * sp, Math.sin(a) * sp, colors, gravity));
    }
    kick();
  },
  rain(type = 'confetti', ms = 2500, colors) {
    const end = performance.now() + ms;
    const tick = () => {
      if (performance.now() > end) return;
      for (let i = 0; i < (reduce ? 1 : 4); i++) {
        parts.push(makePart(type, Math.random() * W, -20, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, colors));
      }
      kick();
      setTimeout(tick, 60);
    };
    tick();
  },

  /* ---------- DOM flights ---------- */
  fly({ from, to, n = 1, html, size = 26, stagger = 90, duration = 650, arc = 0.35, spin = 200, onArrive } = {}) {
    const a = fx.center(from), b = fx.center(to);
    const jobs = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'flyer';
      el.style.width = el.style.height = size + 'px';
      el.innerHTML = html;
      layer.appendChild(el);
      const jx = (Math.random() - 0.5) * 18, jy = (Math.random() - 0.5) * 18;
      const ax = a.x + jx, ay = a.y + jy, bx = b.x + jx * 0.4, by = b.y + jy * 0.4;
      const dist = Math.hypot(bx - ax, by - ay);
      const cx = (ax + bx) / 2 + (by - ay) * arc * (i % 2 ? -0.4 : 0.4), cy = (ay + by) / 2 - dist * arc;
      const frames = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10, u = 1 - t;
        const x = u * u * ax + 2 * u * t * cx + t * t * bx;
        const y = u * u * ay + 2 * u * t * cy + t * t * by;
        const s = 0.7 + Math.sin(t * Math.PI) * 0.6;
        frames.push({ transform: `translate(${x - size / 2}px, ${y - size / 2}px) rotate(${spin * t}deg) scale(${s})`, opacity: t === 0 ? 0 : t > 0.92 ? 0.4 : 1, offset: t });
      }
      const anim = el.animate(frames, { duration: duration / fx.speed, delay: (i * stagger) / fx.speed, easing: 'cubic-bezier(.4,.1,.5,1)', fill: 'both' });
      jobs.push(anim.finished.then(() => { el.remove(); onArrive && onArrive(i); }, () => el.remove()));
    }
    return Promise.all(jobs);
  },

  stamp(text, { at, tone = 'red', rotate = -8, hold = 650, size } = {}) {
    const { x, y } = fx.center(at);
    const el = document.createElement('div');
    el.className = `stamp stamp-${tone}`;
    el.textContent = text;
    if (size) el.style.fontSize = size;
    layer.appendChild(el);
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(W - r.width - 8, x - r.width / 2));
    const top = Math.max(8, Math.min(H - r.height - 8, y - r.height / 2));
    el.style.left = left + 'px'; el.style.top = top + 'px';
    const a = el.animate([
      { transform: `scale(3) rotate(${rotate * 2}deg)`, opacity: 0 },
      { transform: `scale(0.92) rotate(${rotate}deg)`, opacity: 1, offset: 0.25 },
      { transform: `scale(1) rotate(${rotate}deg)`, opacity: 1, offset: 0.35 },
      { transform: `scale(1) rotate(${rotate}deg)`, opacity: 1, offset: 0.8 },
      { transform: `scale(1.15) rotate(${rotate}deg)`, opacity: 0 },
    ], { duration: (hold + 700) / fx.speed, easing: 'ease-out', fill: 'both' });
    return a.finished.then(() => el.remove(), () => el.remove());
  },

  bubble(at, text, { ms = 1600, tone = '' } = {}) {
    const { x, y, h = 0 } = fx.center(at);
    const el = document.createElement('div');
    el.className = 'speech ' + tone;
    el.textContent = text;
    layer.appendChild(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(6, Math.min(W - r.width - 6, x - r.width / 2)) + 'px';
    el.style.top = Math.max(6, y - h / 2 - r.height - 6) + 'px';
    const a = el.animate([
      { transform: 'translateY(8px) scale(.6)', opacity: 0 },
      { transform: 'translateY(0) scale(1.06)', opacity: 1, offset: 0.12 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.2 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.85 },
      { transform: 'translateY(-10px) scale(.95)', opacity: 0 },
    ], { duration: ms, easing: 'ease-out', fill: 'both' });
    a.finished.then(() => el.remove(), () => el.remove());
  },

  shake(power = 1, ms = 420) {
    if (reduce) return;
    const root = document.getElementById('app');
    const k = 7 * power;
    root.animate([
      { transform: 'translate(0,0)' }, { transform: `translate(${-k}px, ${k * 0.4}px) rotate(-.4deg)` },
      { transform: `translate(${k}px, ${-k * 0.3}px) rotate(.4deg)` }, { transform: `translate(${-k * 0.6}px, ${k * 0.2}px)` },
      { transform: `translate(${k * 0.4}px, 0)` }, { transform: 'translate(0,0)' },
    ], { duration: ms / fx.speed, easing: 'ease-out' });
  },

  flash(color = 'rgba(255,255,255,.6)', ms = 380) {
    const el = document.createElement('div');
    el.className = 'flash';
    el.style.background = color;
    layer.appendChild(el);
    el.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: ms / fx.speed }).finished.then(() => el.remove(), () => el.remove());
  },

  /** Overlay an SVG/HTML effect centred on a target, play a keyframe class, then remove. */
  overlay(at, html, cls, ms = 900) {
    const { x, y, w = 120, h = 120 } = fx.center(at);
    const el = document.createElement('div');
    el.className = 'fx-overlay ' + cls;
    const s = Math.max(w, h, 90) * 1.2;
    el.style.width = el.style.height = s + 'px';
    el.style.left = x - s / 2 + 'px';
    el.style.top = y - s / 2 + 'px';
    el.style.animationDuration = ms / fx.speed + 'ms';
    el.innerHTML = html;
    layer.appendChild(el);
    return new Promise((r) => setTimeout(() => { el.remove(); r(); }, ms / fx.speed));
  },
};

/* ---------- particle internals ---------- */
const CORN = ['#FFD23F', '#FFC21A', '#F6A609'];
const CONFETTI = ['#D7263D', '#FFD166', '#2D6A4F', '#9B8EC4', '#A8DADC', '#F3722C', '#ffffff'];

function makePart(type, x, y, vx, vy, colors, gravity) {
  const pal = colors || (type === 'corn' ? CORN : type === 'feather' ? ['#fff', '#f4ead7', '#e8d9bd'] : type === 'dust' ? ['#c9b48a', '#bba57a', '#d9c9a3'] : CONFETTI);
  return {
    type, x, y, vx, vy,
    g: gravity ?? (type === 'feather' ? 0.035 : type === 'spark' ? 0.02 : type === 'dust' ? -0.01 : type === 'confetti' ? 0.05 : 0.22),
    drag: type === 'feather' ? 0.96 : type === 'confetti' ? 0.985 : type === 'dust' ? 0.93 : 0.985,
    life: 0,
    max: type === 'feather' ? 160 + Math.random() * 80 : type === 'confetti' ? 220 + Math.random() * 120 : type === 'dust' ? 50 + Math.random() * 30 : type === 'corn' ? 90 : 40 + Math.random() * 25,
    rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * (type === 'feather' ? 0.08 : 0.3),
    size: type === 'feather' ? 9 + Math.random() * 7 : type === 'dust' ? 8 + Math.random() * 10 : type === 'confetti' ? 5 + Math.random() * 4 : type === 'corn' ? 5 + Math.random() * 2 : 2 + Math.random() * 3,
    color: pal[Math.floor(Math.random() * pal.length)],
    phase: Math.random() * 6.28,
  };
}

function kick() { if (!raf) raf = requestAnimationFrame(loop); }

function loop() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life++;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    if (p.type === 'feather' || p.type === 'confetti') p.x += Math.sin(p.life * 0.07 + p.phase) * 0.9;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr;
    const t = p.life / p.max;
    if (t >= 1 || p.y > H + 40) { parts.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    draw(p, t);
    ctx.restore();
  }
  raf = parts.length ? requestAnimationFrame(loop) : 0;
  if (!raf) ctx.clearRect(0, 0, W, H);
}

function draw(p, t) {
  const s = p.size;
  switch (p.type) {
    case 'corn': {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.35, s * 0.2, s * 0.3, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,0,.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s, 0, 0, 6.283); ctx.stroke();
      break;
    }
    case 'feather': {
      ctx.scale(1, 1 + Math.sin(p.life * 0.1) * 0.15);
      ctx.fillStyle = p.color;
      ctx.strokeStyle = 'rgba(80,60,30,.35)'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.55, -s * 0.2, 0, s);
      ctx.quadraticCurveTo(-s * 0.55, -s * 0.2, 0, -s);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -s * 0.9); ctx.lineTo(0, s * 1.25); ctx.stroke();
      break;
    }
    case 'confetti': {
      ctx.scale(1, Math.cos(p.life * 0.15 + p.phase));
      ctx.fillStyle = p.color;
      ctx.fillRect(-s / 2, -s / 3, s, s * 0.66);
      break;
    }
    case 'dust': {
      ctx.fillStyle = p.color;
      ctx.globalAlpha *= 0.55;
      ctx.beginPath(); ctx.arc(0, 0, s * (1 + t * 1.6), 0, 6.283); ctx.fill();
      break;
    }
    default: { // spark: little 4-point star
      ctx.fillStyle = p.color;
      const r = s * (1.4 - t);
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const rr = k % 2 ? r * 0.35 : r * 1.6;
        const a = (k / 8) * 6.283;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
    }
  }
}
