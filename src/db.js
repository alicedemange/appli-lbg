// Couche d'accès aux données : Supabase en production, navigateur en mode démo.
import { CONFIG } from '../config.js';
import { uuid } from './util.js';
import { buildDemoData } from './demo.js';

export const DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
let sb = null;

export async function initDb() {
  if (DEMO) return;
  const { createClient } = await import('@supabase/supabase-js');
  sb = createClient(CONFIG.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, ''), CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
}

// ── Mode démo : base en mémoire + localStorage ───────────────
const KEY = 'lbg-demo-v8';
let mem = null;
let demoUser = null; // repli si localStorage est indisponible
function store() {
  if (mem) return mem;
  try { const s = localStorage.getItem(KEY); if (s) mem = JSON.parse(s); } catch (e) { /* stockage indisponible */ }
  if (!mem) { mem = buildDemoData(); save(); }
  return mem;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ } }
export function resetDemo() { mem = buildDemoData(); save(); try { localStorage.removeItem('lbg-demo-user'); } catch (e) {} location.hash = ''; location.reload(); }

function match(r, q) {
  for (const [k, v] of Object.entries(q.eq || {})) if (r[k] !== v) return false;
  for (const [k, v] of Object.entries(q.gte || {})) if (r[k] == null || r[k] < v) return false;
  for (const [k, v] of Object.entries(q.lte || {})) if (r[k] == null || r[k] > v) return false;
  for (const [k, v] of Object.entries(q.in || {})) if (!v.includes(r[k])) return false;
  return true;
}
function sortRows(rows, order) {
  if (!order) return rows;
  const os = Array.isArray(order) ? order : [order];
  return [...rows].sort((a, b) => {
    for (const o of os) {
      const d = o.startsWith('-'); const k = o.replace('-', '');
      const av = a[k] ?? '', bv = b[k] ?? '';
      if (av < bv) return d ? 1 : -1;
      if (av > bv) return d ? -1 : 1;
    }
    return 0;
  });
}
const tr = (e) => {
  const m = e?.message || String(e);
  const map = {
    'Invalid login credentials': 'E-mail ou mot de passe incorrect.',
    'User already registered': 'Un compte existe déjà avec cet e-mail : connecte-toi.',
    'Email not confirmed': "Ton adresse e-mail n'est pas encore confirmée (regarde tes mails).",
  };
  for (const [k, v] of Object.entries(map)) if (m.includes(k)) return new Error(v);
  if (m.includes('Password should be')) return new Error('Le mot de passe doit faire au moins 6 caractères.');
  return new Error(m);
};

export const db = {
  async select(t, q = {}) {
    if (DEMO) { const rows = (store()[t] || []).filter((r) => match(r, q)); return structuredClone(sortRows(rows, q.order)); }
    if (q.in) for (const v of Object.values(q.in)) if (!v.length) return [];
    let r = sb.from(t).select('*');
    for (const [k, v] of Object.entries(q.eq || {})) r = r.eq(k, v);
    for (const [k, v] of Object.entries(q.gte || {})) r = r.gte(k, v);
    for (const [k, v] of Object.entries(q.lte || {})) r = r.lte(k, v);
    for (const [k, v] of Object.entries(q.in || {})) r = r.in(k, v);
    for (const o of (Array.isArray(q.order) ? q.order : q.order ? [q.order] : [])) r = r.order(o.replace('-', ''), { ascending: !o.startsWith('-') });
    const { data, error } = await r; if (error) throw tr(error); return data;
  },
  async insert(t, rows) {
    const arr = Array.isArray(rows) ? rows : [rows];
    if (DEMO) {
      let me = demoUser; try { me = localStorage.getItem('lbg-demo-user') || demoUser; } catch (e) {}
      const out = arr.map((r) => ({ id: uuid(), created_at: new Date().toISOString(), ...(['health_events', 'events', 'posts'].includes(t) ? { created_by: me } : {}), ...r }));
      (store()[t] ||= []).push(...out); save(); return structuredClone(out);
    }
    const { data, error } = await sb.from(t).insert(arr).select(); if (error) throw tr(error); return data;
  },
  async update(t, id, patch) {
    if (DEMO) { const r = (store()[t] || []).find((x) => x.id === id); if (r) Object.assign(r, patch); save(); return structuredClone(r); }
    const { data, error } = await sb.from(t).update(patch).eq('id', id).select(); if (error) throw tr(error); return data?.[0];
  },
  async upsert(t, row) {
    if (DEMO) { const ex = (store()[t] || []).find((x) => x.id === row.id); if (ex) Object.assign(ex, row); else (store()[t] ||= []).push(row); save(); return row; }
    const { data, error } = await sb.from(t).upsert(row).select(); if (error) throw tr(error); return data?.[0];
  },
  async remove(t, id) {
    if (DEMO) { const s = store(); s[t] = (s[t] || []).filter((x) => x.id !== id); save(); return; }
    const { error } = await sb.from(t).delete().eq('id', id); if (error) throw tr(error);
  },
};

/** Photo d'un cheval : Supabase Storage (bucket "photos") ou dataURL en démo. */
export async function uploadPhoto(horseId, dataUrl) {
  if (DEMO) return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const path = `${horseId}.jpg`;
  const { error } = await sb.storage.from('photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw tr(error);
  return sb.storage.from('photos').getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
}

// ── Messagerie : discussions d'événements + conversations privées / groupes ──
export const MSG_DAYS = 30; // les messages s'effacent après 30 jours
const T = (kind) => (kind === 'event' ? { table: 'event_messages', col: 'event_id' } : { table: 'messages', col: 'conversation_id' });
/** Écoute les nouveaux messages d'un fil en temps réel. Renvoie une fonction pour arrêter. */
export function subscribeMessages(kind, id, cb) {
  if (DEMO) { const f = (e) => e.key === KEY && (mem = null, cb()); addEventListener('storage', f); return () => removeEventListener('storage', f); }
  const { table, col } = T(kind);
  const ch = sb.channel(`chat-${kind}-${id}`).on('postgres_changes', { event: '*', schema: 'public', table, filter: `${col}=eq.${id}` }, () => cb()).subscribe();
  return () => sb.removeChannel(ch);
}
/** Prévient quand un message arrive n'importe où (pour la pastille « non lus »). */
export function subscribeInbox(cb) {
  if (DEMO) { const f = (e) => e.key === KEY && (mem = null, cb()); addEventListener('storage', f); return () => removeEventListener('storage', f); }
  const ch = sb.channel('inbox').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => cb())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_messages' }, () => cb()).subscribe();
  return () => sb.removeChannel(ch);
}
export async function sendMessage(kind, id, authorId, body, mentions = []) {
  const { table, col } = T(kind);
  return db.insert(table, { [col]: id, author_id: authorId, body, mentions });
}
export async function markRead(kind, id, profileId) {
  const now = new Date().toISOString();
  if (kind === 'event') {
    const row = { event_id: id, profile_id: profileId, last_read_at: now };
    if (DEMO) { const s = store(); s.chat_reads ||= []; const ex = s.chat_reads.find((r) => r.event_id === id && r.profile_id === profileId); ex ? Object.assign(ex, row) : s.chat_reads.push({ id: uuid(), ...row }); save(); return; }
    await sb.from('chat_reads').upsert(row, { onConflict: 'event_id,profile_id' }); return;
  }
  if (DEMO) { const r = (store().conversation_members || []).find((x) => x.conversation_id === id && x.profile_id === profileId); if (r) { r.last_read_at = now; save(); } return; }
  await sb.from('conversation_members').update({ last_read_at: now }).eq('conversation_id', id).eq('profile_id', profileId);
}
/** Conversation privée à deux : la retrouve ou la crée. Renvoie son id. */
export async function getOrCreateDirect(meId, otherId) {
  if (DEMO) {
    const s = store(); s.conversations ||= []; s.conversation_members ||= [];
    const mine = new Set(s.conversation_members.filter((m) => m.profile_id === meId).map((m) => m.conversation_id));
    const ex = s.conversations.find((c) => c.kind === 'direct' && mine.has(c.id) && s.conversation_members.some((m) => m.conversation_id === c.id && m.profile_id === otherId));
    if (ex) return ex.id;
    const c = { id: uuid(), kind: 'direct', title: '', created_by: meId, created_at: new Date().toISOString() };
    s.conversations.push(c);
    s.conversation_members.push({ id: uuid(), conversation_id: c.id, profile_id: meId, last_read_at: c.created_at }, { id: uuid(), conversation_id: c.id, profile_id: otherId, last_read_at: null });
    save(); return c.id;
  }
  const { data, error } = await sb.rpc('get_or_create_direct', { p_other: otherId }); if (error) throw tr(error); return data;
}
export async function createGroup(meId, title, memberIds) {
  if (DEMO) {
    const s = store(); s.conversations ||= []; s.conversation_members ||= [];
    const c = { id: uuid(), kind: 'group', title, created_by: meId, created_at: new Date().toISOString() };
    s.conversations.push(c);
    for (const pid of [...new Set([meId, ...memberIds])]) s.conversation_members.push({ id: uuid(), conversation_id: c.id, profile_id: pid, last_read_at: pid === meId ? c.created_at : null });
    save(); return c.id;
  }
  const { data, error } = await sb.rpc('create_group', { p_title: title, p_members: memberIds }); if (error) throw tr(error); return data;
}
export async function addMembers(convId, ids) {
  if (DEMO) { const s = store(); for (const pid of ids) if (!s.conversation_members.some((m) => m.conversation_id === convId && m.profile_id === pid)) s.conversation_members.push({ id: uuid(), conversation_id: convId, profile_id: pid, last_read_at: null }); save(); return; }
  const { error } = await sb.from('conversation_members').insert(ids.map((profile_id) => ({ conversation_id: convId, profile_id }))); if (error) throw tr(error);
}
export async function leaveConversation(convId, profileId) {
  if (DEMO) { const s = store(); s.conversation_members = s.conversation_members.filter((m) => !(m.conversation_id === convId && m.profile_id === profileId)); save(); return; }
  const { error } = await sb.from('conversation_members').delete().eq('conversation_id', convId).eq('profile_id', profileId); if (error) throw tr(error);
}
/** Ménage : discussions d'événements 2 jours après, et tous les messages de plus de 30 jours. */
export async function purgeChats() {
  if (DEMO) {
    const s = store(); const lim = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10); const old30 = new Date(Date.now() - MSG_DAYS * 864e5).toISOString();
    const old = new Set((s.events || []).filter((e) => e.date < lim).map((e) => e.id));
    s.event_messages = (s.event_messages || []).filter((m) => !old.has(m.event_id) && m.created_at >= old30);
    s.messages = (s.messages || []).filter((m) => m.created_at >= old30); save(); return;
  }
  await sb.rpc('purge_old_chats');
}

// ── Documents privés (contrats, ordonnances…) ───────────────
export async function uploadDoc(horseId, file) {
  if (file.size > (DEMO ? 1.5 : 15) * 1024 * 1024) throw new Error(`Fichier trop lourd (max ${DEMO ? '1,5' : '15'} Mo)`);
  if (DEMO) {
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    return { file_path: data, file_name: file.name };
  }
  const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${horseId}/${uuid()}.${ext}`;
  const { error } = await sb.storage.from('documents').upload(path, file, { contentType: file.type || 'application/pdf' });
  if (error) throw tr(error);
  return { file_path: path, file_name: file.name };
}
/** Lien temporaire (1 h) pour ouvrir un document privé. */
export async function docUrl(doc) {
  if (!doc.file_path) return null;
  if (DEMO || doc.file_path.startsWith('data:')) return doc.file_path;
  const { data, error } = await sb.storage.from('documents').createSignedUrl(doc.file_path, 3600);
  if (error) throw tr(error); return data.signedUrl;
}
export async function removeDocFile(doc) {
  if (DEMO || !doc.file_path) return;
  await sb.storage.from('documents').remove([doc.file_path]);
}
export async function acceptDoc(id, name, meId) {
  if (DEMO) return db.update('documents', id, { accepted_at: new Date().toISOString(), accepted_by: meId, accepted_name: name });
  const { error } = await sb.rpc('accept_document', { p_id: id, p_name: name }); if (error) throw tr(error);
}

// ── Authentification : prénom (identifiant) + code PIN ───────
/** « Chloé », « Alice D. » → « chloe », « alice.d » */
export const loginSlug = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
const loginEmail = (slug) => `${slug}@${CONFIG.LOGIN_DOMAIN || 'membres.ecurie-active-lbg.fr'}`;
const cleanPin = (pin = '') => pin.replace(/\s+/g, '').toUpperCase();
const BAD = 'Prénom ou code PIN incorrect.';
export const DEMO_PIN = 'LBG123';

export const auth = {
  async current() {
    if (DEMO) {
      let id = demoUser; try { id = localStorage.getItem('lbg-demo-user') || demoUser; } catch (e) {}
      return id ? (store().profiles.find((p) => p.id === id) || null) : null;
    }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    return data || { id: session.user.id, role: 'nouveau', email: session.user.email };
  },
  demoProfiles: () => store().profiles,
  demoLogin(id) { demoUser = id; try { localStorage.setItem('lbg-demo-user', id); } catch (e) {} },
  /**
   * Connexion avec le prénom (identifiant) et le code PIN.
   * 1re fois : le code PIN donné par l'écurie crée le compte automatiquement.
   */
  async pinLogin(name, pin) {
    const slug = loginSlug(name); const code = cleanPin(pin);
    if (!slug || code.length < 6) throw new Error(BAD);
    if (DEMO) {
      const p = store().profiles.find((x) => (x.login && x.login === slug) || loginSlug(x.full_name) === slug || loginSlug(x.full_name.split(' ')[0]) === slug);
      if (!p || code !== DEMO_PIN) throw new Error(`${BAD} (Démo : un prénom de l’écurie, ex. « Chloé », et le code ${DEMO_PIN})`);
      auth.demoLogin(p.id); return;
    }
    const email = loginEmail(slug);
    const first = await sb.auth.signInWithPassword({ email, password: code });
    if (!first.error) return;
    if (!/invalid login credentials/i.test(first.error.message)) throw tr(first.error);
    // Première connexion ? On vérifie le code PIN d'accès avant de créer le compte.
    const { data: ok, error: e1 } = await sb.rpc('check_first_login', { p_login: slug, p_code: code });
    if (e1) throw tr(e1);
    if (ok === 'bloque') throw new Error('Trop d’essais avec ce prénom : demande un nouveau code PIN à Nathalie.');
    if (ok !== 'ok') throw new Error(BAD);
    const { data, error } = await sb.auth.signUp({ email, password: code, options: { data: { full_name: name.trim() } } });
    if (error) throw tr(error);
    if (!data.session) throw new Error('Réglage Supabase à faire : désactive « Confirm email » (Authentication › Sign In / Providers › Email).');
    const r = await auth.claim(code);
    if (r !== 'ok') throw new Error(r);
  },
  /** Relie le compte à l'écurie avec le code PIN : renvoie 'ok' ou un message d'erreur. */
  async claim(code, full_name, phone) {
    const { data, error } = await sb.rpc('claim_invitation', { p_code: cleanPin(code), p_full_name: full_name || null, p_phone: phone || null });
    if (error) throw tr(error);
    if (data === 'ok') return 'ok';
    if (data === 'bloque') return 'Trop d’essais : demande un nouveau code PIN à Nathalie.';
    return `Code PIN incorrect ou expiré (${data.split(':')[1] || '?'} essai(s) restant(s)).`;
  },
  /** Changer son propre code PIN (6 caractères minimum). */
  async changePin(pin) {
    const code = cleanPin(pin);
    if (code.length < 6) throw new Error('Le code PIN doit faire au moins 6 caractères.');
    if (DEMO) return code;
    const { error } = await sb.auth.updateUser({ password: code }); if (error) throw tr(error);
    return code;
  },
  /** Admin : génère un nouveau code PIN pour un membre (code oublié). */
  async adminResetPin(profileId) {
    if (DEMO) return 'NEW' + Math.random().toString(36).slice(2, 5).toUpperCase();
    const { data, error } = await sb.rpc('admin_reset_pin', { p_profile: profileId }); if (error) throw tr(error);
    return data;
  },
  async signOut() {
    if (DEMO) { demoUser = null; try { localStorage.removeItem('lbg-demo-user'); } catch (e) {} return; }
    await sb.auth.signOut();
  },
  onChange(cb) { if (!DEMO) sb.auth.onAuthStateChange((ev) => cb(ev)); },
};
