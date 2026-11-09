import { html, useState, useEffect, useRef, createContext, useContext } from './lib.js';
import { colorFor, initials, cls } from './util.js';

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// ── Icônes (traits style "lucide") ───────────────────────────
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  horse: '<path d="M5 3v7a7 7 0 0 0 14 0V3"/><path d="M5 7h2M17 7h2M5.6 13h2M16.4 13h2"/>',
  health: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M3.5 12h3l1.5-3 2 6 1.5-3h3"/>',
  idea: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M16 7l3 3M14 9l2 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  edit: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3.3 16.8a2 2 0 0 1 2.8-2.8L8 16"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
};
export function Icon({ n, size = 20, class: c = '' }) {
  return html`<svg class=${'ic ' + c} width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: P[n] || '' }}></svg>`;
}

export const LOGO_URL = 'assets/logo.png';
export const MONO_URL = 'assets/monogram.png';
/** Monogramme « BG » dans un médaillon crème (barre latérale, en-tête mobile). */
export function Logo({ size = 44 }) {
  return html`<span class="mono" style=${`--s:${size}px`}><img src=${MONO_URL} alt="Écuries la Barthe Grande" /></span>`;
}
/** Logo complet (écran de connexion). */
export const FullLogo = ({ width = 260 }) => html`<img class="full-logo" src=${LOGO_URL} width=${width} alt="Écuries la Barthe Grande" />`;

export function Avatar({ p, name, size = 32 }) {
  const nm = p?.full_name || name || '?';
  return html`<span class="av" style=${`--s:${size}px;background:${p?.color || colorFor(nm)}`} title=${nm}>${initials(nm)}</span>`;
}
export function AvStack({ people, max = 5, size = 24 }) {
  const shown = people.slice(0, max);
  return html`<span class="avstack">${shown.map((p) => html`<${Avatar} p=${p} size=${size} />`)}${people.length > max && html`<span class="av more" style=${`--s:${size}px`}>+${people.length - max}</span>`}</span>`;
}
export function HorseAvatar({ h, size = 44 }) {
  if (h?.photo) return html`<img class="hav" src=${h.photo} alt=${h.name} style=${`--s:${size}px`} />`;
  return html`<span class="hav ph" style=${`--s:${size}px;background:${colorFor(h?.name || '')}`}>${(h?.name || '?')[0]}</span>`;
}

export const Badge = ({ color, children, soft = true }) =>
  html`<span class=${cls('badge', soft && 'soft')} style=${`--c:${color}`}>${children}</span>`;

// ── Modales ──────────────────────────────────────────────────
let listeners = new Set(); let stack = []; let seq = 0;
const emit = () => listeners.forEach((f) => f([...stack]));
export function openModal(render) {
  const id = ++seq;
  const close = () => { stack = stack.filter((m) => m.id !== id); emit(); };
  stack.push({ id, render, close }); emit();
  return close;
}
export function ModalHost() {
  const [s, set] = useState(stack);
  useEffect(() => { listeners.add(set); return () => listeners.delete(set); }, []);
  useEffect(() => { document.body.classList.toggle('noscroll', s.length > 0); }, [s.length]);
  return html`${s.map((m) => html`<div key=${m.id}>${m.render(m.close)}</div>`)}`;
}
export function Modal({ title, close, children, wide, accent, footer, icon }) {
  const ref = useRef();
  useEffect(() => {
    const k = (e) => { if (e.key !== 'Escape') return; const all = document.querySelectorAll('.overlay'); if (all[all.length - 1] === ref.current) close(); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, []);
  return html`<div class="overlay" ref=${ref} onMouseDown=${(e) => e.target === e.currentTarget && close()}>
    <div class=${cls('modal', wide && 'wide')} style=${accent ? `--accent:${accent}` : ''} role="dialog" aria-modal="true">
      <header class="modal-h">${icon && html`<span class="modal-ic">${icon}</span>`}<h2>${title}</h2>
        <button class="icon-btn" onClick=${close} aria-label="Fermer"><${Icon} n="x" /></button></header>
      <div class="modal-b">${children}</div>
      ${footer && html`<footer class="modal-f">${footer}</footer>`}
    </div></div>`;
}
export function confirmBox(message, { ok = 'Confirmer', danger = false } = {}) {
  return new Promise((res) => {
    openModal((close) => {
      const done = (v) => { close(); res(v); };
      return html`<${Modal} title="Confirmation" close=${() => done(false)} footer=${html`
        <button class="btn ghost" onClick=${() => done(false)}>Annuler</button>
        <button class=${cls('btn', danger ? 'danger' : 'primary')} onClick=${() => done(true)}>${ok}</button>`}>
        <p>${message}</p></${Modal}>`;
    });
  });
}

// ── Toasts ───────────────────────────────────────────────────
let tl = new Set(); let toasts = [];
export function toast(msg, kind = 'ok') {
  const id = Math.random();
  toasts = [...toasts, { id, msg, kind }]; tl.forEach((f) => f(toasts));
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); tl.forEach((f) => f(toasts)); }, 3200);
}
export function Toasts() {
  const [t, set] = useState(toasts);
  useEffect(() => { tl.add(set); return () => tl.delete(set); }, []);
  return html`<div class="toasts">${t.map((x) => html`<div class=${'toast ' + x.kind} key=${x.id}>${x.msg}</div>`)}</div>`;
}
export const fail = (e) => { console.error(e); toast(e?.message || 'Oups, une erreur est survenue', 'err'); };

// ── Formulaires ──────────────────────────────────────────────
export function useForm(init) {
  const [v, setV] = useState(init);
  const set = (k, val) => setV((o) => ({ ...o, [k]: val }));
  const bind = (k) => ({ value: v[k] ?? '', onInput: (e) => set(k, e.target.value) });
  return { v, set, bind, setV };
}
export const Field = ({ label, hint, children, wide }) =>
  html`<label class=${cls('field', wide && 'wide')}><span class="lbl">${label}</span>${children}${hint && html`<small class="hint">${hint}</small>`}</label>`;

export function Seg({ options, value, onChange, small }) {
  return html`<div class=${cls('seg', small && 'small')} role="radiogroup">${options.map(([k, label, color]) =>
    html`<button type="button" role="radio" aria-checked=${value === k} class=${cls(value === k && 'on')} style=${color ? `--c:${color}` : ''} onClick=${() => onChange(k)}>${label}</button>`)}</div>`;
}
export function ChipPick({ options, value = [], onChange }) {
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return html`<div class="chips">${options.map(([k, label]) =>
    html`<button type="button" class=${cls('chip', value.includes(k) && 'on')} onClick=${() => toggle(k)}>${value.includes(k) && html`<${Icon} n="check" size=${14} />`}${label}</button>`)}</div>`;
}
export const Tabs = ({ tabs, value, onChange }) =>
  html`<div class="tabs" role="tablist">${tabs.map(([k, label]) => html`<button role="tab" aria-selected=${value === k} class=${cls(value === k && 'on')} onClick=${() => onChange(k)}>${label}</button>`)}</div>`;

export const Empty = ({ icon = '🐴', title, text, children }) =>
  html`<div class="empty"><div class="empty-ic">${icon}</div><strong>${title}</strong>${text && html`<p>${text}</p>`}${children}</div>`;

export const PageHead = ({ title, sub, children }) =>
  html`<div class="page-head"><div><h1>${title}</h1>${sub && html`<p class="sub">${sub}</p>`}</div><div class="page-actions">${children}</div></div>`;

export function useData(loader, deps = []) {
  const [s, set] = useState({ data: null, loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    loader().then((d) => alive && set({ data: d, loading: false })).catch((e) => { fail(e); alive && set({ data: null, loading: false }); });
    return () => { alive = false; };
  }, [...deps, n]);
  return [s.data, () => setN((x) => x + 1), s.loading];
}
export const Loading = () => html`<div class="loading"><span class="spin"></span>Chargement…</div>`;
