// ── Dates ────────────────────────────────────────────────────
export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISO(new Date());
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
export const diffDays = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 864e5); // b - a
export const weekStart = (s) => { const d = parseISO(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); };

export const DOW = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export function fmtDate(s, style = 'short') {
  if (!s) return '—';
  const d = parseISO(s);
  if (style === 'long') return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (style === 'full') return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (style === 'yy') return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
  if (style === 'dm') return `${d.getDate()} ${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][d.getMonth()]}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export const fmtTime = (t) => (t ? t.slice(0, 5).replace(':', 'h') : '');
export function relDays(n) {
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'demain';
  if (n === -1) return 'hier';
  const a = Math.abs(n);
  const txt = a < 45 ? `${a} j` : a < 700 ? `${Math.round(a / 30.4)} mois` : `${Math.round(a / 365)} ans`;
  return n > 0 ? `dans ${txt}` : `il y a ${txt}`;
}
export function age(birth) {
  if (!birth) return null;
  return Math.floor(diffDays(birth, todayISO()) / 365.25);
}

// ── Divers ───────────────────────────────────────────────────
export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const initials = (n = '?') => n.trim().split(/[\s-]+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const PALETTE = ['#2f5d8a', '#7a5c4f', '#4f8a5b', '#8a5aa6', '#c0812f', '#2f8a8a', '#b4505a', '#5b6bb8', '#7a8a2f', '#6b4f3a'];
export function colorFor(s = '') { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
export const cls = (...a) => a.filter(Boolean).join(' ');
export const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function genCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; const r = crypto.getRandomValues(new Uint32Array(6));
  for (const x of r) s += A[x % A.length];
  return s;
}

// ── Référentiels ─────────────────────────────────────────────
export const ROLES = {
  admin: { label: 'Gérante / admin', short: 'Admin', color: '#24415f' },
  proprietaire: { label: 'Propriétaire', short: 'Propriétaire', color: '#7a5c4f' },
  dp: { label: 'Demi-pension / Tiers', short: 'DP / TP', color: '#4f8a5b' },
  nouveau: { label: 'En attente', short: 'En attente', color: '#888' },
  archive: { label: 'Ancien membre (archivé)', short: 'Archivé', color: '#a8a29e' },
};
export const isActive = (p) => ['admin', 'proprietaire', 'dp'].includes(p?.role);


export const EVENT_TYPES = {
  cours: { label: 'Cours', icon: '🎓', color: '#3b6ea8' },
  animation: { label: 'Animation', icon: '🎉', color: '#d38b1f' },
  stage: { label: 'Stage', icon: '⭐', color: '#7b5ea7' },
  concours: { label: 'Concours', icon: '🏆', color: '#3f8a5a' },
  sortie: { label: 'Sortie / balade', icon: '🌳', color: '#2f8a8a' },
  info: { label: 'Info écurie', icon: '📌', color: '#6b7280' },
};

export const HEALTH_TYPES = {
  vaccin: { label: 'Vaccin', icon: '💉', every: 365, warn: 30, track: true, lot: true, color: '#8a4fb3', adminOnly: true },
  vermifuge: { label: 'Vermifuge', icon: '💊', every: 120, warn: 15, track: true, lot: true, color: '#1f8f84' },
  marechal: { label: 'Maréchal', icon: '🔨', every: 49, warn: 7, track: true, color: '#9a5b2e' },
  dentiste: { label: 'Dentiste', icon: '🦷', every: 365, warn: 30, track: true, color: '#2f63a8' },
  osteo: { label: 'Ostéo', icon: '🤲', every: 365, warn: 30, track: true, color: '#d1891a' },
  veto: { label: 'Vétérinaire', icon: '🩺', color: '#c2453d' },
  bobo: { label: 'Bobo / soin', icon: '🩹' },
  antiparasitaire: { label: 'Antiparasitaire ext.', icon: '🪰', lot: true },
  autre: { label: 'Autre', icon: '📝' },
};
export const TRACKED = Object.keys(HEALTH_TYPES).filter((k) => HEALTH_TYPES[k].track);

export const STATE_META = {
  ok: { label: 'À jour', color: '#3f8a5a' },
  soon: { label: 'Bientôt', color: '#d38b1f' },
  late: { label: 'En retard', color: '#c2453d' },
  planned: { label: 'Prévu', color: '#3b6ea8' },
  none: { label: 'Pas de donnée', color: '#a8a29e' },
};

/** Statut d'un suivi (vaccin, maréchal…) pour un cheval. */
export function healthStatus(evts, type) {
  const T = HEALTH_TYPES[type];
  const today = todayISO();
  const mine = evts.filter((e) => e.type === type);
  const done = mine.filter((e) => e.status !== 'prevu').sort((a, b) => b.date.localeCompare(a.date));
  const planned = mine.filter((e) => e.status === 'prevu' && e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const last = done[0] || null;
  if (!last) return { state: planned ? 'planned' : 'none', last, planned, next: planned?.date || null, left: null };
  const next = last.next_due || addDays(last.date, T.every);
  const left = diffDays(today, next);
  let state = left < 0 ? 'late' : left <= (T.warn ?? 30) ? 'soon' : 'ok';
  if (planned && state !== 'ok') state = 'planned';
  return { state, last, planned, next: planned?.date || next, left };
}

export const PENSIONS = { base: 'Pension de base', plus: 'Pension Plus', max: 'Pension Max', poulain: 'Pension poulain', autre: 'Autre' };
export const SEXES = { jument: 'Jument', hongre: 'Hongre', entier: 'Entier' };
export const IDEA_CATS = {
  animation: { label: 'Animation', icon: '🎉' },
  sortie: { label: 'Sortie / balade', icon: '🌳' },
  stage: { label: 'Stage / formation', icon: '⭐' },
  materiel: { label: 'Matériel / installations', icon: '🧰' },
  autre: { label: 'Autre', icon: '💬' },
};
export const IDEA_STATUS = {
  nouvelle: { label: 'Nouvelle', color: '#3b6ea8' },
  etudiee: { label: 'On y réfléchit', color: '#d38b1f' },
  validee: { label: 'Validée 🎉', color: '#3f8a5a' },
  realisee: { label: 'Réalisée', color: '#6b7280' },
  refusee: { label: 'Pas pour cette fois', color: '#a8a29e' },
};
export const CONTACT_CATS = {
  veterinaire: { label: 'Vétérinaires', icon: '🩺' },
  marechal: { label: 'Maréchal-ferrant', icon: '🔨' },
  osteo: { label: 'Ostéopathe', icon: '🤲' },
  dentiste: { label: 'Dentiste', icon: '🦷' },
  ecurie: { label: 'Écurie', icon: '🏡' },
  autre: { label: 'Autres', icon: '📇' },
};

export async function downloadText(name, text, type = 'text/csv', bom = true) {
  const data = (bom ? '\ufeff' : '') + text; // BOM : accents corrects dans Excel
  // Dans l'aperçu Claude, le téléchargement passe par la capacité "downloads"
  if (window.claude?.use) {
    try { const d = await window.claude.use('downloads'); if (d) { await d.save({ filename: name, data }); return; } } catch (e) { return; }
  }
  const blob = new Blob([data], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export const csv = (rows) => rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');

/** Redimensionne une photo en JPEG (dataURL) pour la stocker légèrement. */
export function resizeImage(file, max = 700) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
