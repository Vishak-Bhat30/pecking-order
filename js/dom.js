// Small DOM helpers + shared card markup.
import { ROLES, ACTIONS } from './roles.js';
import { characterSVG, cardBackSVG, iconSVG, henSVG } from './art.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const corn = (n) => `<span class="corn-amt">${iconSVG('corn')}<b>${n}</b></span>`;

export function cardFront(role, { mini = false, act = false, cls = '' } = {}) {
  const R = ROLES[role];
  if (!R) return '';
  return `<div class="card front role-${role} ${mini ? 'mini' : ''} ${act ? 'act' : ''} ${cls}" style="--bg:${R.bg};--rink:${R.ink}">
    <div class="card-sun"></div>
    <div class="card-art">${characterSVG(role)}</div>
    <div class="card-ribbon"><span>${R.name}</span></div>
    ${mini ? '' : `<div class="card-text"><b>${esc(R.power)}</b><span>${esc(R.counter)}</span></div>`}
  </div>`;
}

export function cardBack(cls = '') {
  return `<div class="card back ${cls}">${cardBackSVG()}</div>`;
}

export function hen(look, cls = '') {
  return `<div class="hen-wrap ${cls}">${henSVG(look || { color: 0, hat: 0 })}</div>`;
}

export function roleTag(role) {
  const R = ROLES[role];
  return R ? `<span class="rtag" style="--bg:${R.bg};--rink:${R.ink}">${R.name}</span>` : '';
}

export function actionName(a) { return ACTIONS[a] ? ACTIONS[a].name : a; }

let toastT;
export function toast(msg, kind = '') {
  let t = $('#toast');
  if (!t) { t = el('<div id="toast"></div>'); document.body.appendChild(t); }
  t.className = 'show ' + kind;
  t.innerHTML = esc(msg);
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = ''; }, 3200);
}

export function modal(html, { cls = '', onClose } = {}) {
  const m = el(`<div class="modal-back"><div class="modal ${cls}"><button class="modal-x" aria-label="Close">✕</button>${html}</div></div>`);
  const close = () => {
    m.classList.add('closing');
    setTimeout(() => m.remove(), 220);
    document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.modal-x')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
  return { el: m, close };
}
