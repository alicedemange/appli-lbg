// Onglet « Messages » : conversations privées, groupes, et discussions des balades / événements.
import { html, useState, useEffect } from '../lib.js';
import { db, getOrCreateDirect, createGroup, addMembers, leaveConversation, subscribeInbox, MSG_DAYS } from '../db.js';
import { useApp, Icon, Avatar, AvStack, Modal, openModal, confirmBox, toast, fail, useForm, Field, ChipPick, useData, Empty, Loading } from '../ui.js';
import { todayISO, addDays, fmtDate, fmtTime, EVENT_TYPES, norm, cls } from '../util.js';
import { ChatThread, chatOpen, CHAT_DAYS } from './chat.js';

/** Toutes mes discussions, triées par dernier message, avec le nombre de non-lus. */
export async function loadInbox(app) {
  const me = app.me.id; const today = todayISO();
  const [myParts, myEvents, myConvRows] = await Promise.all([
    db.select('event_participants', { eq: { profile_id: me } }),
    db.select('events', { eq: { created_by: me }, gte: { date: addDays(today, -CHAT_DAYS) } }),
    db.select('conversation_members', { eq: { profile_id: me } }),
  ]);
  const evIds = [...new Set([...myParts.map((x) => x.event_id), ...myEvents.map((e) => e.id)])];
  const convIds = myConvRows.map((r) => r.conversation_id);
  const [events, evMsgs, reads, convs, convMembers, msgs] = await Promise.all([
    db.select('events', { in: { id: evIds }, gte: { date: addDays(today, -CHAT_DAYS) } }),
    db.select('event_messages', { in: { event_id: evIds }, order: '-created_at' }),
    db.select('chat_reads', { eq: { profile_id: me } }),
    db.select('conversations', { in: { id: convIds } }),
    db.select('conversation_members', { in: { conversation_id: convIds } }),
    db.select('messages', { in: { conversation_id: convIds }, order: '-created_at' }),
  ]);
  const items = [];
  for (const e of events) {
    if (e.type === 'cours' || e.open === false) continue;
    const ms = evMsgs.filter((m) => m.event_id === e.id);
    if (!ms.length) continue;
    const read = reads.find((r) => r.event_id === e.id)?.last_read_at || '';
    items.push({ kind: 'event', id: e.id, key: 'e-' + e.id, e, title: e.title, sub: fmtDate(e.date, 'long'), last: ms[0], unread: ms.filter((m) => m.author_id !== me && m.created_at > read).length });
  }
  for (const c of convs) {
    const mem = convMembers.filter((m) => m.conversation_id === c.id);
    const others = mem.filter((m) => m.profile_id !== me).map((m) => app.P[m.profile_id]).filter(Boolean);
    const ms = msgs.filter((m) => m.conversation_id === c.id);
    const read = myConvRows.find((r) => r.conversation_id === c.id)?.last_read_at || '';
    if (c.kind === 'direct' && !ms.length && c.created_by !== me) continue;
    items.push({ kind: 'conv', id: c.id, key: 'c-' + c.id, c, others, members: mem, title: c.kind === 'direct' ? (others[0]?.full_name || 'Ancien membre') : c.title,
      sub: c.kind === 'group' ? `${mem.length} membres` : 'Message privé', last: ms[0], unread: ms.filter((m) => m.author_id !== me && m.created_at > read).length });
  }
  items.sort((a, b) => (b.last?.created_at || b.c?.created_at || '').localeCompare(a.last?.created_at || a.c?.created_at || ''));
  return items;
}

/** Ouvre (ou crée) la conversation privée avec quelqu'un. */
export async function openDirect(app, profileId) {
  try { const id = await getOrCreateDirect(app.me.id, profileId); location.hash = 'chat-c-' + id; } catch (e) { fail(e); }
}

/** Petit compteur global de messages non lus (menu). */
export function useUnread(app) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!app) return;
    let alive = true;
    const refresh = () => loadInbox(app).then((it) => alive && setN(it.reduce((a, x) => a + x.unread, 0))).catch(() => {});
    refresh(); const off = subscribeInbox(refresh); const t = setInterval(refresh, 30000);
    addEventListener('hashchange', refresh);
    return () => { alive = false; off(); clearInterval(t); removeEventListener('hashchange', refresh); };
  }, [app?.me?.id]);
  return n;
}

function ConvIcon({ it, size = 44 }) {
  if (it.kind === 'event') return html`<span class="conv-ic" style=${`--s:${size}px;--c:${EVENT_TYPES[it.e.type]?.color}`}>${EVENT_TYPES[it.e.type]?.icon}</span>`;
  if (it.c.kind === 'direct') return html`<${Avatar} p=${it.others[0]} name="?" size=${size} />`;
  return html`<span class="conv-ic group" style=${`--s:${size}px`}>👥</span>`;
}

// ═════════════════════ PAGE MESSAGES ═════════════════════
export function Messages({ arg = '' }) {
  const app = useApp();
  const [items, reload] = useData(() => loadInbox(app), [arg]);
  const [q, setQ] = useState('');
  useEffect(() => { const off = subscribeInbox(reload); return off; }, []);
  const [k, ...rest] = arg.split('-'); const selId = rest.join('-');
  const sel = items?.find((x) => x.id === selId) || null;
  const list = (items || []).filter((x) => !q || norm(x.title + ' ' + (x.others || []).map((p) => p.full_name).join(' ')).includes(norm(q)));

  return html`<section class=${cls('page messenger', arg && 'has-sel')}>
    <div class="msgr">
      <aside class="inbox">
        <div class="inbox-h"><h1>Messages</h1>
          <div class="inbox-act">
            <button class="btn small" onClick=${() => openNewDirect(app)}><${Icon} n="edit" size=${15} /> Nouveau</button>
            <button class="btn small" onClick=${() => openNewGroup(app)}>👥 Groupe</button>
          </div></div>
        <label class="search"><${Icon} n="search" size=${18} /><input placeholder="Rechercher" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
        ${!items ? html`<${Loading} />` : !list.length ? html`<${Empty} icon="💬" title="Pas encore de discussion" text="Écris à quelqu’un depuis l’annuaire (💬), crée un groupe, ou inscris-toi à une balade." />`
          : html`<ul class="conv-list">${list.map((it) => html`<li><a href=${'#chat-' + it.key} class=${cls('conv', sel?.id === it.id && 'on', it.unread && 'unread-row')}>
            <${ConvIcon} it=${it} />
            <span class="cv-b"><span class="cv-top"><b>${it.title}</b><small>${it.last ? relTime(it.last.created_at) : ''}</small></span>
              <small class="cv-last">${it.last ? (it.last.author_id === app.me.id ? 'Toi : ' : it.kind !== 'conv' || it.c.kind === 'group' ? (app.P[it.last.author_id]?.full_name || '?') + ' : ' : '') + it.last.body : it.sub}</small></span>
            ${it.unread > 0 && html`<span class="unread">${it.unread}</span>`}</a></li>`)}</ul>`}
        <p class="hint">🧹 Les messages s’effacent automatiquement après ${MSG_DAYS} jours (et 2 jours après une balade ou un événement).</p>
      </aside>
      <div class="pane">
        ${!arg ? html`<div class="pane-empty"><span>💬</span><p>Choisis une discussion ou écris à quelqu’un.</p></div>`
          : !items ? html`<${Loading} />`
          : !sel ? html`<div class="pane-empty"><span>🫥</span><p>Cette discussion n’existe plus (elle a peut-être été effacée).</p><a class="btn" href="#chat">Retour</a></div>`
          : html`<${ThreadPane} it=${sel} reload=${reload} />`}
      </div>
    </div>
  </section>`;
}
function relTime(iso) {
  const d = iso.slice(0, 10); const t = todayISO();
  if (d === t) return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (d === addDays(t, -1)) return 'hier';
  return fmtDate(d, 'dm');
}

function ThreadPane({ it, reload }) {
  const app = useApp();
  const people = it.kind === 'event' ? null : it.members.map((m) => app.P[m.profile_id]).filter(Boolean);
  return html`<div class="pane-in" key=${it.key}>
    <header class="pane-h">
      <a class="icon-btn back-btn" href="#chat" aria-label="Retour"><${Icon} n="left" /></a>
      <${ConvIcon} it=${it} size=${38} />
      <div class="ph-b"><b>${it.title}</b>
        <small>${it.kind === 'event' ? html`${fmtDate(it.e.date, 'long')}${it.e.start_time ? ' · ' + fmtTime(it.e.start_time) : ''} · s’efface 2 jours après` : it.c.kind === 'group' ? people.map((p) => p.full_name).join(', ') : html`${it.others[0]?.phone ? html`<a href=${'tel:' + it.others[0].phone.replace(/\s/g, '')}>📞 ${it.others[0].phone}</a>` : 'Message privé'}`}</small></div>
      ${it.kind === 'event' && html`<button class="btn small ghost" onClick=${() => import('./planning.js').then((m) => m.openEvent(app, it.e.id, reload))}>Voir l’événement</button>`}
      ${it.kind === 'conv' && it.c.kind === 'group' && html`<button class="btn small ghost" onClick=${() => openGroupInfo(app, it, reload)}>⚙️ Groupe</button>`}
    </header>
    ${it.kind === 'event'
      ? html`<${EventThread} it=${it} />`
      : html`<${ChatThread} kind="conv" id=${it.id} people=${people} emptyText=${it.c.kind === 'direct' ? `Écris ton premier message à ${it.title} 👋` : 'Groupe créé ! Écris le premier message 👋'} />`}
  </div>`;
}
function EventThread({ it }) {
  const app = useApp();
  const [parts] = useData(() => db.select('event_participants', { eq: { event_id: it.id } }), [it.id]);
  if (!parts) return html`<${Loading} />`;
  return html`<${ChatThread} kind="event" id=${it.id} people=${parts.filter((x) => x.status !== 'absent').map((x) => app.P[x.profile_id])} mentionAll closed=${!chatOpen(it.e)} />`;
}

// ═════════════════════ NOUVEAU MESSAGE / GROUPE ═════════════════════
function openNewDirect(app) { openModal((close) => html`<${NewDirect} close=${close} />`); }
function NewDirect({ close }) {
  const app = useApp(); const [q, setQ] = useState('');
  const list = app.members.filter((p) => p.id !== app.me.id && (!q || norm(p.full_name).includes(norm(q))));
  return html`<${Modal} title="Nouveau message" icon="✏️" close=${close}>
    <label class="search" style="max-width:none;margin-bottom:10px"><${Icon} n="search" size=${18} /><input autofocus placeholder="À qui veux-tu écrire ?" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
    <ul class="pick-list">${list.map((p) => html`<li><button onClick=${() => { close(); openDirect(app, p.id); }}><${Avatar} p=${p} size=${34} /><span><b>${p.full_name}</b><small>${app.horses.filter((h) => h.owner_id === p.id && !h.departure_date).map((h) => h.name).join(', ')}</small></span></button></li>`)}</ul>
  </${Modal}>`;
}
function openNewGroup(app) { openModal((close) => html`<${NewGroup} close=${close} />`); }
function NewGroup({ close }) {
  const app = useApp(); const f = useForm({ title: '', members: [] }); const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); if (!f.v.members.length) return toast('Choisis au moins une personne', 'err');
    setBusy(true);
    try { const id = await createGroup(app.me.id, f.v.title.trim(), f.v.members); close(); location.hash = 'chat-c-' + id; toast('Groupe créé 👥'); } catch (er) { fail(er); }
    setBusy(false);
  };
  return html`<${Modal} title="Créer un groupe" icon="👥" close=${close} footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="ngf" disabled=${busy}>Créer</button>`}>
    <form id="ngf" class="form" onSubmit=${save}>
      <${Field} label="Nom du groupe"><input required maxlength="60" placeholder="Ex. Team concours 🏆, Covoiturage CSO, Les propriétaires…" ...${f.bind('title')} /></${Field}>
      <${Field} label="Membres" hint="Tu pourras en ajouter d’autres plus tard."><${ChipPick} value=${f.v.members} onChange=${(v) => f.set('members', v)} options=${app.members.filter((p) => p.id !== app.me.id).map((p) => [p.id, p.full_name])} /></${Field}>
      <p class="hint" style="margin:0">Les messages du groupe s’effacent après ${MSG_DAYS} jours ; le groupe, lui, reste.</p>
    </form></${Modal}>`;
}
function openGroupInfo(app, it, reload) { openModal((close) => html`<${GroupInfo} it=${it} close=${close} reload=${reload} />`); }
function GroupInfo({ it, close, reload }) {
  const app = useApp(); const [add, setAdd] = useState([]); const [title, setTitle] = useState(it.c.title);
  const memberIds = it.members.map((m) => m.profile_id);
  const isCreator = it.c.created_by === app.me.id;
  const doAdd = async () => { try { await addMembers(it.id, add); setAdd([]); reload(); close(); toast('Ajouté·e·s au groupe'); } catch (e) { fail(e); } };
  const rename = async () => { try { await db.update('conversations', it.id, { title }); reload(); toast('Groupe renommé'); } catch (e) { fail(e); } };
  const leave = async () => { if (await confirmBox(`Quitter le groupe « ${it.c.title} » ?`, { ok: 'Quitter', danger: true })) { try { await leaveConversation(it.id, app.me.id); close(); location.hash = 'chat'; } catch (e) { fail(e); } } };
  const del = async () => { if (await confirmBox(`Supprimer le groupe « ${it.c.title} » et tous ses messages, pour tout le monde ?`, { ok: 'Supprimer', danger: true })) { try { await db.remove('conversations', it.id); close(); location.hash = 'chat'; } catch (e) { fail(e); } } };
  return html`<${Modal} title=${it.c.title} icon="👥" close=${close} footer=${html`${isCreator && html`<button class="btn ghost danger" onClick=${del}><${Icon} n="trash" size=${16} /> Supprimer</button>`}<span class="grow"></span><button class="btn ghost danger" onClick=${leave}>Quitter le groupe</button>`}>
    <div class="form">
      ${isCreator && html`<div class="inline-form" style="margin:0"><input value=${title} onInput=${(e) => setTitle(e.target.value)} maxlength="60" /><button class="btn" disabled=${!title.trim() || title === it.c.title} onClick=${rename}>Renommer</button></div>`}
      <h3 class="sec" style="margin:4px 0 0">Membres (${memberIds.length})</h3>
      <ul class="plist">${it.members.map((m) => { const p = app.P[m.profile_id]; return html`<li><span class="pname"><${Avatar} p=${p} size=${28} /><b>${p?.full_name || 'Ancien membre'}</b>${m.profile_id === it.c.created_by && html`<small> · a créé le groupe</small>`}</span><span class="grow"></span>
        ${m.profile_id !== app.me.id && p && html`<button class="icon-btn" title="Message privé" onClick=${() => { close(); openDirect(app, p.id); }}>💬</button>`}</li>`; })}</ul>
      <${Field} label="Ajouter des membres"><${ChipPick} value=${add} onChange=${setAdd} options=${app.members.filter((p) => !memberIds.includes(p.id)).map((p) => [p.id, p.full_name])} /></${Field}>
      ${add.length > 0 && html`<button class="btn primary" onClick=${doAdd}>Ajouter ${add.length} personne${add.length > 1 ? 's' : ''}</button>`}
    </div></${Modal}>`;
}

// ═════════════════════ ACCUEIL : DISCUSSIONS RÉCENTES ═════════════════════
export function InboxHome({ openEvent }) {
  const app = useApp(); const me = app.me.id;
  const [d] = useData(async () => {
    const items = await loadInbox(app);
    // invitations par @mention à une balade où je ne suis pas inscrit·e
    const ment = (await db.select('event_messages', { order: '-created_at' })).filter((m) => (m.mentions || []).includes(me) && !items.some((x) => x.kind === 'event' && x.id === m.event_id));
    const evs = ment.length ? await db.select('events', { in: { id: [...new Set(ment.map((m) => m.event_id))] }, gte: { date: todayISO() } }) : [];
    return { items, invites: evs.map((e) => ({ e, m: ment.find((m) => m.event_id === e.id) })) };
  }, []);
  if (!d) return null;
  const top = d.items.filter((x) => x.last).slice(0, 4);
  if (!top.length && !d.invites.length) return null;
  const unread = d.items.reduce((a, x) => a + x.unread, 0);
  return html`<div class="card chats-card"><h3>💬 Messages ${unread > 0 && html`<span class="unread inline">${unread}</span>`}</h3>
    ${d.invites.map(({ e, m }) => html`<button class="chat-row invite" onClick=${() => openEvent(app, e.id)}>
      <span class="conv-ic" style=${`--s:38px;--c:${EVENT_TYPES[e.type]?.color}`}>${EVENT_TYPES[e.type]?.icon}</span>
      <span class="cr-b"><b>${app.P[m?.author_id]?.full_name} t’invite : ${e.title}</b><small>${m?.body}</small></span><span class="badge" style="--c:#2f8a8a">Invitation</span></button>`)}
    ${top.map((it) => html`<a class="chat-row" href=${'#chat-' + it.key}><${ConvIcon} it=${it} size=${38} />
      <span class="cr-b"><b>${it.title}</b><small>${it.last.author_id === me ? 'Toi' : app.P[it.last.author_id]?.full_name} : ${it.last.body}</small></span>
      ${it.unread > 0 && html`<span class="unread">${it.unread}</span>`}</a>`)}
    <a class="link" href="#chat">Tous les messages →</a>
  </div>`;
}
