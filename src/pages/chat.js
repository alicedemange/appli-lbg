// Balades proposées par les cavaliers + discussion (chat) propre à chaque événement.
import { html, useState, useEffect, useRef, useMemo } from '../lib.js';
import { db, subscribeMessages, markRead, sendMessage } from '../db.js';
import { useApp, Icon, Avatar, Modal, openModal, toast, fail, useForm, Field, Seg, ChipPick, useData } from '../ui.js';
import { todayISO, addDays, fmtDate, fmtTime, parseISO, DOW, EVENT_TYPES, norm, cls } from '../util.js';

export const CHAT_DAYS = 2; // la discussion s'efface 2 jours après l'événement
export const chatEnd = (e) => addDays(e.date, CHAT_DAYS);
export const chatOpen = (e) => todayISO() <= chatEnd(e);
const blankPart = { status: 'inscrit', bring: '', group_label: '', class_name: '', bib: '', result: '', note: '' };

// ═════════════════════ PROPOSER UNE BALADE ═════════════════════
export function openBalade(app, init = {}, reload, after) { openModal((close) => html`<${BaladeForm} init=${init} close=${close} reload=${reload} after=${after} />`); }
function BaladeForm({ init, close, reload, after }) {
  const app = useApp(); const editing = !!init.id;
  const mine = app.activeHorses.filter((h) => app.myHorseIds.includes(h.id));
  const f = useForm({ title: '', date: todayISO(), start_time: '', end_time: '', location: '', description: '', capacity: '', open: true, horse_id: mine.length === 1 ? mine[0].id : '', invite: [], ...init,
    start_time: init.start_time?.slice(0, 5) || '', end_time: init.end_time?.slice(0, 5) || '', capacity: init.capacity ?? '', open: init.open !== false });
  const save = async (ev) => {
    ev.preventDefault();
    const row = { type: 'sortie', title: f.v.title.trim() || 'Balade', date: f.v.date, start_time: f.v.start_time || null, end_time: f.v.end_time || null, location: f.v.location, description: f.v.description, capacity: f.v.open && f.v.capacity ? Number(f.v.capacity) : null, open: !!f.v.open };
    try {
      if (editing) { await db.update('events', init.id, row); close(); reload?.(); toast('Balade modifiée'); return; }
      const [e] = await db.insert('events', { ...row, created_by: app.me.id });
      await db.insert('event_participants', { event_id: e.id, profile_id: app.me.id, horse_id: f.v.horse_id || null, ...blankPart });
      if (f.v.open && f.v.invite.length) {
        const names = f.v.invite.map((id) => '@' + app.P[id]?.full_name).join(' ');
        await db.insert('event_messages', { event_id: e.id, author_id: app.me.id, body: `${names} je pars en balade ${fmtDate(f.v.date, 'long')}${f.v.start_time ? ' à ' + fmtTime(f.v.start_time) : ''}, ça vous dit de venir ? 🌳`, mentions: f.v.invite });
      }
      close(); reload?.(); after?.(e);
      toast(f.v.open ? 'Balade proposée 🌳 Les autres peuvent s’inscrire' : 'Balade en solo ajoutée au planning 🌳');
    } catch (er) { fail(er); }
  };
  return html`<${Modal} title=${editing ? 'Modifier ma balade' : 'Proposer une balade'} icon="🌳" accent=${EVENT_TYPES.sortie.color} close=${close}
    footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="balf">${editing ? 'Enregistrer' : 'Ajouter au planning'}</button>`}>
    <form id="balf" class="form" onSubmit=${save}>
      <div class="solo-pick">
        <button type="button" class=${cls(f.v.open && 'on')} onClick=${() => f.set('open', true)}><span>👭</span><b>Ouverte</b><small>D’autres cavaliers peuvent se joindre à moi</small></button>
        <button type="button" class=${cls(!f.v.open && 'on')} onClick=${() => f.set('open', false)}><span>🧘</span><b>Je préfère être seule</b><small>Visible au planning (sécurité), sans inscription</small></button>
      </div>
      <${Field} label="Titre"><input placeholder="Ex. Balade au lac, tour des crêtes, petite sortie au pas…" ...${f.bind('title')} /></${Field}>
      <div class="row3">
        <${Field} label="Jour"><input type="date" required min=${editing ? '' : todayISO()} ...${f.bind('date')} /></${Field}>
        <${Field} label="Départ"><input type="time" ...${f.bind('start_time')} /></${Field}>
        <${Field} label="Retour prévu"><input type="time" ...${f.bind('end_time')} /></${Field}>
      </div>
      <div class="row2">
        <${Field} label="Parcours / lieu"><input placeholder="Lac de la Ganguise, chemin des crêtes…" ...${f.bind('location')} /></${Field}>
        ${!editing && mine.length > 0 && html`<${Field} label="Mon cheval"><select ...${f.bind('horse_id')}><option value="">—</option>${mine.map((h) => html`<option value=${h.id}>${h.name}</option>`)}</select></${Field}>`}
      </div>
      <${Field} label="Infos" hint=${f.v.open ? 'Allures, niveau, durée… pour que chacun sache si ça lui convient.' : ''}><textarea rows="2" placeholder=${f.v.open ? 'Ex. tranquille au pas et au trot, environ 1 h 30' : 'Ex. petit tour au pas'} ...${f.bind('description')}></textarea></${Field}>
      ${f.v.open && html`
        <${Field} label="Places max (cavaliers)" hint="Vide = pas de limite"><input type="number" min="2" ...${f.bind('capacity')} /></${Field}>
        ${!editing && html`<${Field} label="Inviter des cavaliers (facultatif)" hint="Ils seront notifiés dans l’appli et pourront s’inscrire."><${ChipPick} value=${f.v.invite} onChange=${(v) => f.set('invite', v)} options=${app.members.filter((p) => p.id !== app.me.id).map((p) => [p.id, p.full_name])} /></${Field}>`}`}
      <p class="hint">${f.v.open ? '💬 Une discussion est créée pour les inscrits. Elle s’efface automatiquement 2 jours après la balade.' : '🔒 Personne ne pourra s’inscrire. Pense à prévenir quelqu’un de ton heure de retour.'}</p>
    </form></${Modal}>`;
}

// ═════════════════════ DISCUSSION D'UN ÉVÉNEMENT ═════════════════════
const MENTION = /@([\p{L}][\p{L}' -]{0,30})/gu;
function renderBody(body, members) {
  const names = members.map((p) => p.full_name).sort((a, b) => b.length - a.length);
  const out = []; let rest = body;
  while (rest.length) {
    const i = rest.indexOf('@');
    if (i < 0) { out.push(rest); break; }
    out.push(rest.slice(0, i));
    const hit = names.find((n) => rest.slice(i + 1, i + 1 + n.length).toLowerCase() === n.toLowerCase());
    if (hit) { out.push(html`<span class="mention">@${hit}</span>`); rest = rest.slice(i + 1 + hit.length); }
    else { out.push('@'); rest = rest.slice(i + 1); }
  }
  return out;
}

/**
 * Fil de discussion générique.
 * kind = 'event' (discussion d'un événement) ou 'conv' (conversation privée / groupe).
 * people = personnes qui participent (pour savoir qui n'est « pas encore inscrit·e »).
 */
export function ChatThread({ kind, id, people = [], closed, mentionAll = false, emptyText, compact }) {
  const app = useApp(); const { me, P } = app;
  const { table, col } = kind === 'event' ? { table: 'event_messages', col: 'event_id' } : { table: 'messages', col: 'conversation_id' };
  const [msgs, reload] = useData(() => db.select(table, { eq: { [col]: id }, order: 'created_at' }), [kind, id]);
  const [text, setText] = useState(''); const [ment, setMent] = useState([]); const [busy, setBusy] = useState(false);
  const listRef = useRef(); const inRef = useRef();
  useEffect(() => { const off = subscribeMessages(kind, id, reload); const t = setInterval(reload, 20000); return () => { off(); clearInterval(t); }; }, [kind, id]);
  useEffect(() => { if (msgs) { markRead(kind, id, me.id).catch(() => {}); listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight); } }, [msgs?.length, id]);

  const pool = mentionAll ? app.members : people.filter(Boolean);
  const q = (text.match(/@([\p{L}' -]*)$/u) || [])[1];
  const sugg = q === undefined ? [] : pool.filter((p) => p.id !== me.id && norm(p.full_name).startsWith(norm(q.trimStart()))).slice(0, 6);
  const pick = (p) => { setText(text.replace(/@([\p{L}' -]*)$/u, '@' + p.full_name + ' ')); setMent([...new Set([...ment, p.id])]); inRef.current?.focus(); };
  const notIn = (pid) => !people.some((x) => x?.id === pid);
  const send = async (ev) => {
    ev.preventDefault(); const body = text.trim(); if (!body) return;
    const mentions = ment.filter((x) => body.includes('@' + P[x]?.full_name));
    setBusy(true);
    try { await sendMessage(kind, id, me.id, body, mentions); setText(''); setMent([]); reload(); } catch (er) { fail(er); }
    setBusy(false);
  };
  let lastDay = '';
  return html`<div class=${cls('thread', compact && 'compact')}>
    <div class="chat-list" ref=${listRef}>
      ${!msgs ? html`<p class="muted small center">…</p>` : !msgs.length ? html`<p class="chat-empty">${emptyText || 'Aucun message pour l’instant. Dis bonjour 👋'}</p>`
        : msgs.map((m) => { const mine = m.author_id === me.id; const d = m.created_at.slice(0, 10); const sep = d !== lastDay; lastDay = d; const a = P[m.author_id];
          return html`${sep && html`<div class="chat-day">${fmtDate(d, 'long')}</div>`}
            <div class=${cls('msg', mine && 'mine')}>${!mine && html`<${Avatar} p=${a} size=${28} />`}
              <div class="bubble">${!mine && html`<b class="who">${a?.full_name || '?'}</b>`}<span class="txt">${renderBody(m.body, app.profiles)}</span>
                <small>${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}${kind === 'event' && m.mentions?.some(notIn) ? ' · invitation envoyée' : ''}</small></div></div>`; })}
    </div>
    ${!closed ? html`<form class="chat-in" onSubmit=${send}>
      ${sugg.length > 0 && html`<div class="sugg">${sugg.map((p) => html`<button type="button" onMouseDown=${(ev) => { ev.preventDefault(); pick(p); }}><${Avatar} p=${p} size=${22} />${p.full_name}${kind === 'event' && notIn(p.id) ? html`<small>pas encore inscrit·e</small>` : ''}</button>`)}</div>`}
      <input ref=${inRef} placeholder=${'Écrire un message…' + (pool.length > 1 ? ' (@ pour mentionner)' : '')} value=${text} onInput=${(ev) => setText(ev.target.value)} maxlength="2000" />
      <button class="btn primary" disabled=${busy || !text.trim()} aria-label="Envoyer">➤</button></form>`
    : html`<p class="muted small center" style="padding:8px">Discussion terminée : elle va être effacée.</p>`}
  </div>`;
}

/** Discussion d'un événement (dans la fiche de l'événement). */
export function ChatBox({ e, parts }) {
  const app = useApp();
  const people = parts.filter((x) => x.status !== 'absent').map((x) => app.P[x.profile_id]);
  return html`<div class="chat">
    <div class="chat-h"><b>💬 Discussion</b><small>${people.length} participant·e·s · s’efface le ${fmtDate(chatEnd(e), 'long')} · <a href=${'#chat-e-' + e.id}>ouvrir dans Messages</a></small></div>
    <${ChatThread} kind="event" id=${e.id} people=${people} mentionAll closed=${!chatOpen(e)}
      emptyText="Personne n’a encore écrit. Lance l’organisation : heure de rendez-vous, parcours, qui amène quoi… Tape @ pour mentionner quelqu’un." />
  </div>`;
}

// ═════════════════════ PHOTOS & VIDÉOS (liens WeTransfer, Drive…) ═════════════════════
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const isWeTransfer = (u) => /wetransfer\.com|we\.tl/i.test(u);
export function PhotoLinks({ e }) {
  const app = useApp();
  const [links, reload] = useData(() => db.select('event_links', { eq: { event_id: e.id }, order: 'created_at' }), [e.id]);
  const f = useForm({ url: '', label: '' }); const [adding, setAdding] = useState(false);
  const add = async (ev) => {
    ev.preventDefault();
    let url = f.v.url.trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (!host(url)) return toast('Lien invalide', 'err');
    try { await db.insert('event_links', { event_id: e.id, author_id: app.me.id, url, label: f.v.label.trim() }); f.setV({ url: '', label: '' }); setAdding(false); reload(); toast('Lien ajouté 📸'); } catch (er) { fail(er); }
  };
  if (!links) return null;
  return html`<div class="photos">
    <div class="photos-h"><b>📸 Photos & vidéos</b>${!adding && html`<button class="btn small" onClick=${() => setAdding(true)}><${Icon} n="plus" size=${14} /> Ajouter un lien</button>`}</div>
    ${!links.length && !adding && html`<p class="muted small">Le photographe ou un cavalier a envoyé les photos ? Colle ici le lien WeTransfer, Google Photos, Drive… Il restera accessible à tous, même après ${e.type === 'concours' ? 'le concours' : 'l’événement'}.</p>`}
    ${links.map((l) => html`<div class="plink">
      <span class="pl-ic">${isWeTransfer(l.url) ? '📦' : '🖼️'}</span>
      <a href=${l.url} target="_blank" rel="noopener noreferrer" class="pl-b"><b>${l.label || (isWeTransfer(l.url) ? 'Photos (WeTransfer)' : 'Photos')}</b><small>${host(l.url)} · ajouté par ${app.P[l.author_id]?.full_name || '?'} le ${fmtDate(l.created_at.slice(0, 10), 'dm')}</small>
        ${isWeTransfer(l.url) && html`<small class="warn">⏳ Les liens WeTransfer gratuits expirent après quelques jours : télécharge vite !</small>`}</a>
      ${(app.isAdmin || l.author_id === app.me.id) && html`<button class="icon-btn" aria-label="Supprimer le lien" onClick=${async () => { await db.remove('event_links', l.id).catch(fail); reload(); }}><${Icon} n="trash" size=${15} /></button>`}
    </div>`)}
    ${adding && html`<form class="inline-form" onSubmit=${add}>
      <input type="url" required placeholder="https://we.tl/… ou lien Google Photos" ...${f.bind('url')} />
      <input placeholder="Ex. Photos Club 1 — photographe" ...${f.bind('label')} />
      <button class="btn primary">Ajouter</button><button type="button" class="btn ghost" onClick=${() => setAdding(false)}>Annuler</button></form>`}
  </div>`;
}

/** Accueil : liens photos ajoutés ces 30 derniers jours. */
export function PhotosHome({ openEvent }) {
  const app = useApp();
  const [d] = useData(async () => {
    const links = await db.select('event_links', { gte: { created_at: new Date(Date.now() - 30 * 864e5).toISOString() }, order: '-created_at' });
    const evs = links.length ? await db.select('events', { in: { id: [...new Set(links.map((l) => l.event_id))] } }) : [];
    return { links, evs };
  }, []);
  if (!d || !d.links.length) return null;
  return html`<div class="card"><h3>📸 Photos récentes</h3>${d.links.slice(0, 4).map((l) => { const e = d.evs.find((x) => x.id === l.event_id);
    return html`<div class="plink"><span class="pl-ic">${isWeTransfer(l.url) ? '📦' : '🖼️'}</span><a class="pl-b" href=${l.url} target="_blank" rel="noopener noreferrer"><b>${l.label || 'Photos'}</b><small>${e ? e.title + ' · ' + fmtDate(e.date, 'dm') : ''}</small></a>
      ${e && html`<button class="btn small ghost" onClick=${() => openEvent(app, e.id)}>Voir</button>`}</div>`; })}</div>`;
}
