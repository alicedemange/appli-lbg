import { html, useState, useMemo } from '../lib.js';
import { db } from '../db.js';
import { useApp, Icon, Avatar, HorseAvatar, Modal, openModal, confirmBox, toast, fail, useForm, Field, Seg, Badge, useData, PageHead, Empty, Loading, Tabs } from '../ui.js';
import { isActive, todayISO, addDays, fmtDate, fmtTime, EVENT_TYPES, HEALTH_TYPES, TRACKED, STATE_META, healthStatus, ROLES, IDEA_CATS, IDEA_STATUS, CONTACT_CATS, cls, norm, DOW, parseISO } from '../util.js';
import { openPresence, openEvent, openEventForm, PRES_KINDS } from './planning.js';
import { HealthDots } from './horses.js';
import { ContractsHome } from './documents.js';
import { PhotosHome, openBalade } from './chat.js';
import { InboxHome, openDirect } from './messages.js';

// ═════════════════════ ACCUEIL ═════════════════════
export function Home() {
  const app = useApp(); const { me, isAdmin, P, H, myHorseIds } = app;
  const today = todayISO();
  const [d, reload] = useData(async () => {
    const [events, pres, mineP, health, posts, ideas, votes] = await Promise.all([
      db.select('events', { gte: { date: today }, lte: { date: addDays(today, 21) }, order: ['date', 'start_time'] }),
      db.select('presences', { eq: { date: today }, order: 'time' }),
      db.select('event_participants', { eq: { profile_id: me.id } }),
      isAdmin ? db.select('health_events') : myHorseIds.length ? db.select('health_events', { in: { horse_id: myHorseIds } }) : [],
      db.select('posts', { eq: { kind: 'annonce' }, order: '-created_at' }),
      db.select('suggestions', { order: '-created_at' }),
      db.select('suggestion_votes'),
    ]);
    const todayEv = events.filter((e) => e.date === today);
    const parts = await db.select('event_participants', { in: { event_id: events.map((e) => e.id) } });
    return { events, todayEv, pres, mineP, health, posts, ideas, votes, parts };
  }, []);
  const h = new Date().getHours();
  const hello = h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
  if (!d) return html`<section class="page"><${Loading} /></section>`;

  const myEvents = d.events.filter((e) => d.mineP.some((p) => p.event_id === e.id));
  const highlights = d.events.filter((e) => e.type !== 'cours' && e.open !== false && !myEvents.includes(e)).slice(0, 4);
  const by = {}; for (const e of d.health) (by[e.horse_id] ||= []).push(e);
  const watch = isAdmin ? app.horses.filter((x) => !x.departure_date).flatMap((x) => TRACKED.map((t) => ({ h: x, t, s: healthStatus(by[x.id] || [], t) }))).filter((x) => x.s.state === 'late' || x.s.state === 'soon') : [];
  const votes = (id) => d.votes.filter((v) => v.suggestion_id === id).length;
  const topIdeas = [...d.ideas].filter((i) => ['nouvelle', 'etudiee'].includes(i.status)).sort((a, b) => votes(b.id) - votes(a.id)).slice(0, 3);
  const myHorses = app.horses.filter((x) => myHorseIds.includes(x.id));
  const myCare = d.health.filter((e) => e.status === 'prevu' && e.date >= today && myHorseIds.includes(e.horse_id)).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 5);
  const pinned = d.posts.filter((p) => p.pinned).concat(d.posts.filter((p) => !p.pinned)).slice(0, 2);
  const present = d.pres.filter((p) => p.kind !== 'absent'); const absent = d.pres.filter((p) => p.kind === 'absent');

  return html`<section class="page home">
    <div class="hero">
      <div><p class="hero-date">${fmtDate(today, 'long')}</p><h1>${hello} ${me.full_name?.split(' ')[0]} 👋</h1>
        <p class="sub">${present.length ? `${present.length} personne${present.length > 1 ? 's' : ''} prévue${present.length > 1 ? 's' : ''} à l’écurie aujourd’hui` : 'Personne ne s’est encore signalé aujourd’hui'}${d.todayEv.length ? ` · ${d.todayEv.length} événement${d.todayEv.length > 1 ? 's' : ''}` : ''}.</p></div>
      <div class="quick">
        <button class="qa" onClick=${() => openPresence(app, { date: today }, reload)}><span>🏇</span>Je viens</button>
        <button class="qa" onClick=${() => openPresence(app, { date: today, kind: 'absent' }, reload)}><span>🚫</span>Absence</button>
        ${myHorses.length > 0 && html`<button class="qa" onClick=${() => app.openHealth({ type: 'bobo' }, reload)}><span>🩹</span>Noter un soin</button>`}
        <button class="qa" onClick=${() => openBalade(app, { date: today }, reload)}><span>🌳</span>Balade</button>
        <a class="qa" href="#idees"><span>💡</span>Une idée</a>
        ${isAdmin && html`<button class="qa" onClick=${() => openEventForm(app, { date: today }, reload)}><span>📅</span>Événement</button>`}
      </div>
    </div>

    <div class="home-grid">
      ${!isAdmin && html`<${ContractsHome} />`}
      <${InboxHome} openEvent=${openEvent} />
      <div class="card today-card"><h3>☀️ Aujourd’hui à l’écurie</h3>
        ${d.todayEv.map((e) => { const T = EVENT_TYPES[e.type]; const n = d.parts.filter((p) => p.event_id === e.id && p.status !== 'absent').length;
          return html`<button class="row-ev" style=${`--c:${T.color}`} onClick=${() => openEvent(app, e.id, reload)}><span class="re-t">${fmtTime(e.start_time) || 'Journée'}</span><span>${T.icon} <b>${e.title}</b></span><small>${n} inscrit·e·s</small></button>`; })}
        ${present.length > 0 && html`<div class="who">${present.map((p) => html`<span class="who-chip"><${Avatar} p=${P[p.profile_id]} size=${22} />${P[p.profile_id]?.full_name}<small>${p.time ? fmtTime(p.time) : ''} ${p.kind !== 'monte' ? PRES_KINDS[p.kind].icon : ''}</small></span>`)}</div>`}
        ${absent.length > 0 && html`<p class="muted small">🚫 Absent·e·s : ${absent.map((p) => P[p.profile_id]?.full_name).join(', ')}</p>`}
        ${!d.todayEv.length && !d.pres.length && html`<p class="muted">Calme plat pour l’instant. Signale ta venue pour que les autres sachent qui est là 🙂</p>`}
        <a class="link" href="#planning">Voir le planning de la semaine →</a>
      </div>

      <div class="card"><h3>🗓️ Mes prochains rendez-vous</h3>
        ${(() => {
          const items = [...myEvents.map((e) => ({ k: 'ev', e, key: e.date + (e.start_time || '') })), ...myCare.map((e) => ({ k: 'hs', e, key: e.date + (e.time || '') }))].sort((a, b) => a.key.localeCompare(b.key)).slice(0, 7);
          if (!items.length) return html`<p class="muted">Tu n’es inscrit·e à rien dans les 3 prochaines semaines.</p>`;
          return html`<ul class="next-list">${items.map(({ k, e }) => { const dd = parseISO(e.date);
            if (k === 'hs') return html`<li><button onClick=${() => app.openHealth(e, reload)} style="--c:#7a5c4f"><span class="date-box"><small>${DOW[dd.getDay()].slice(0, 3)}</small><b>${dd.getDate()}</b></span>
              <span class="nl-main"><b>${HEALTH_TYPES[e.type]?.icon} ${HEALTH_TYPES[e.type]?.label} — ${H[e.horse_id]?.name}</b><small>${e.time ? fmtTime(e.time) : 'heure à préciser'}${e.practitioner ? ' · ' + e.practitioner : ''}</small></span></button></li>`;
            const T = EVENT_TYPES[e.type]; const p = d.mineP.find((x) => x.event_id === e.id);
            return html`<li><button onClick=${() => openEvent(app, e.id, reload)} style=${`--c:${T.color}`}><span class="date-box"><small>${DOW[dd.getDay()].slice(0, 3)}</small><b>${dd.getDate()}</b></span>
              <span class="nl-main"><b>${T.icon} ${e.title}</b><small>${fmtTime(e.start_time)}${e.location ? ' · ' + e.location : ''}${p.status === 'absent' ? ' · absent·e' : ''}</small>
              ${(p.bib || p.class_name || p.group_label) && html`<span class="nl-tags">${p.group_label && html`<${Badge} color=${T.color}>${p.group_label}${p.slot_time ? ' · ' + fmtTime(p.slot_time) : ''}</${Badge}>`}${p.class_name && html`<${Badge} color=${T.color}>${p.class_name}</${Badge}>`}${p.bib && html`<${Badge} color=${T.color}>Dossard ${p.bib}</${Badge}>`}${p.class_time && html`<${Badge} color=${T.color}>⏱ ${fmtTime(p.class_time)}</${Badge}>`}</span>`}</span></button></li>`;
          })}</ul>`;
        })()}
      </div>

      ${myHorses.length > 0 && html`<div class="card"><h3>🐴 ${myHorses.length > 1 ? 'Mes chevaux' : 'Mon cheval'}</h3>
        ${myHorses.map((x) => html`<a class="my-horse" href=${'#cheval-' + x.id}><${HorseAvatar} h=${x} size=${48} /><span class="mh-b"><b>${x.name}</b><${HealthDots} evts=${by[x.id] || []} size="sm" /></span><${Icon} n="right" size=${18} /></a>`)}
      </div>`}

      ${isAdmin && html`<div class="card"><h3>⚠️ À surveiller</h3>
        ${!watch.length ? html`<p class="muted">Tout est à jour 🎉</p>` : html`<div class="watch">${TRACKED.map((t) => { const l = watch.filter((w) => w.t === t); if (!l.length) return null;
          return html`<div class="watch-row"><span class="w-ic">${HEALTH_TYPES[t].icon}</span><div><b>${HEALTH_TYPES[t].label}</b><div class="w-list">${l.map((w) => html`<a href=${'#cheval-' + w.h.id} class=${'w-chip ' + w.s.state} style=${`--c:${STATE_META[w.s.state].color}`}>${w.h.name}</a>`)}</div></div></div>`; })}</div>`}
        <a class="link" href="#sante">Ouvrir le tableau sanitaire →</a></div>`}
      ${isAdmin && html`<${ContractsHome} />`}

      ${highlights.length > 0 && html`<div class="card"><h3>✨ À venir à l’écurie</h3>${highlights.map((e) => { const T = EVENT_TYPES[e.type];
        return html`<button class="row-ev" style=${`--c:${T.color}`} onClick=${() => openEvent(app, e.id, reload)}><span class="re-t">${fmtDate(e.date, 'dm')}</span><span>${T.icon} <b>${e.title}</b></span><small>S’inscrire →</small></button>`; })}</div>`}

      <${PhotosHome} openEvent=${openEvent} />
      ${pinned.length > 0 && html`<div class="card"><h3>📣 Annonces</h3>${pinned.map((p) => html`<div class="post"><b>${p.pinned ? '📌 ' : ''}${p.title}</b><p>${p.body}</p></div>`)}<a class="link" href="#infos">Toutes les infos →</a></div>`}

      ${topIdeas.length > 0 && html`<div class="card"><h3>💡 Idées du moment</h3>${topIdeas.map((i) => html`<a class="idea-mini" href="#idees"><span>${IDEA_CATS[i.category]?.icon}</span><b>${i.title}</b><span class="votes">🙋 ${votes(i.id)}</span></a>`)}<a class="link" href="#idees">Proposer une idée →</a></div>`}
    </div>
  </section>`;
}

// ═════════════════════ ANNUAIRE ═════════════════════
export function Annuaire() {
  const app = useApp();
  const [tab, setTab] = useState('membres'); const [q, setQ] = useState('');
  const members = app.profiles.filter((p) => isActive(p) && (!q || norm(p.full_name + app.horses.filter((h) => h.owner_id === p.id).map((h) => h.name).join(' ')).includes(norm(q))));
  const groups = [['admin', 'L’équipe'], ['proprietaire', 'Propriétaires'], ['dp', 'Demi-pensions & tiers']];
  const Tel = ({ n }) => n ? html`<a class="tel" href=${'tel:' + n.replace(/\s/g, '')}><${Icon} n="phone" size=${14} /> ${n}</a>` : html`<span class="muted small">pas de numéro</span>`;
  return html`<section class="page">
    <${PageHead} title="Annuaire" sub="Un clic sur un numéro pour appeler." >${app.isAdmin && tab === 'pros' && html`<button class="btn primary" onClick=${() => openContact(app, {})}><${Icon} n="plus" /> Contact</button>`}</${PageHead}>
    <div class="toolbar"><${Tabs} value=${tab} onChange=${setTab} tabs=${[['membres', '👥 Cavaliers'], ['pros', '🩺 Professionnels']]} />
      ${tab === 'membres' && html`<label class="search"><${Icon} n="search" size=${18} /><input placeholder="Nom, cheval…" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>`}</div>
    ${tab === 'membres' ? groups.map(([role, label]) => { const l = members.filter((p) => p.role === role); if (!l.length) return null;
      return html`<h3 class="sec">${label} <small class="muted">${l.length}</small></h3><div class="people-grid">${l.map((p) => {
        const own = app.horses.filter((h) => h.owner_id === p.id); const ride = app.riders.filter((r) => r.profile_id === p.id);
        return html`<div class="person"><${Avatar} p=${p} size=${44} /><div class="pp-b"><b>${p.full_name}</b>
          <div class="pp-horses">${own.map((h) => html`<a href=${'#cheval-' + h.id} class="hchip">🐴 ${h.name}</a>`)}${ride.map((r) => html`<a href=${'#cheval-' + r.horse_id} class="hchip alt">${r.kind} ${app.H[r.horse_id]?.name}</a>`)}</div>
          <${Tel} n=${p.phone} /></div>
          ${p.id !== app.me.id && html`<button class="chat-btn" title=${'Écrire à ' + p.full_name} aria-label=${'Écrire à ' + p.full_name} onClick=${() => openDirect(app, p.id)}><${Icon} n="message" size=${18} /></button>`}</div>`; })}</div>`; })
    : Object.entries(CONTACT_CATS).map(([k, c]) => { const l = app.contacts.filter((x) => x.category === k); if (!l.length) return null;
      return html`<h3 class="sec">${c.icon} ${c.label}</h3><div class="people-grid">${l.map((x) => html`<div class="person"><span class="pro-ic">${c.icon}</span><div class="pp-b"><b>${x.name}</b>${x.note && html`<small class="muted">${x.note}</small>`}<${Tel} n=${x.phone} />${x.email && html`<a class="small" href=${'mailto:' + x.email}>${x.email}</a>`}</div>
        ${app.isAdmin && html`<button class="icon-btn" aria-label="Modifier" onClick=${() => openContact(app, x)}><${Icon} n="edit" size=${16} /></button>`}</div>`)}</div>`; })}
    ${tab === 'membres' && html`<p class="hint">🔒 L’annuaire n’est visible que par les membres connectés de l’écurie. Chacun peut modifier son numéro dans « Mon profil ».</p>`}
  </section>`;
}
function openContact(app, c) { openModal((close) => html`<${ContactForm} c=${c} close=${close} />`); }
function ContactForm({ c, close }) {
  const app = useApp(); const f = useForm({ name: '', category: 'veterinaire', phone: '', email: '', note: '', ...c });
    const save = async (e) => { e.preventDefault(); try { const row = { name: f.v.name, category: f.v.category, phone: f.v.phone, email: f.v.email, note: f.v.note }; c.id ? await db.update('contacts', c.id, row) : await db.insert('contacts', row); await app.reloadBase(); close(); } catch (er) { fail(er); } };
    const del = async () => { if (await confirmBox('Supprimer ce contact ?', { ok: 'Supprimer', danger: true })) { await db.remove('contacts', c.id).catch(fail); await app.reloadBase(); close(); } };
    return html`<${Modal} title=${c.id ? 'Modifier le contact' : 'Nouveau contact'} close=${close} footer=${html`${c.id && html`<button class="btn ghost danger" onClick=${del}><${Icon} n="trash" size=${16} /></button>`}<span class="grow"></span><button class="btn primary" form="cf">Enregistrer</button>`}>
      <form id="cf" class="form" onSubmit=${save}><${Field} label="Nom"><input required ...${f.bind('name')} /></${Field}>
        <${Field} label="Catégorie"><select ...${f.bind('category')}>${Object.entries(CONTACT_CATS).map(([k, x]) => html`<option value=${k}>${x.icon} ${x.label}</option>`)}</select></${Field}>
        <div class="row2"><${Field} label="Téléphone"><input type="tel" ...${f.bind('phone')} /></${Field}><${Field} label="E-mail"><input type="email" ...${f.bind('email')} /></${Field}></div>
        <${Field} label="Note"><input ...${f.bind('note')} /></${Field}></form></${Modal}>`;
}

// ═════════════════════ BOÎTE À IDÉES ═════════════════════
export function Idees() {
  const app = useApp(); const { me, isAdmin, P } = app;
  const [d, reload] = useData(async () => ({ ideas: await db.select('suggestions', { order: '-created_at' }), votes: await db.select('suggestion_votes') }), []);
  const [filter, setFilter] = useState('ouvertes');
  if (!d) return html`<section class="page"><${Loading} /></section>`;
  const vOf = (id) => d.votes.filter((v) => v.suggestion_id === id);
  const list = d.ideas.filter((i) => filter === 'toutes' || (filter === 'ouvertes' ? ['nouvelle', 'etudiee', 'validee'].includes(i.status) : ['realisee', 'refusee'].includes(i.status)))
    .sort((a, b) => vOf(b.id).length - vOf(a.id).length);
  const vote = async (i) => {
    const mine = vOf(i.id).find((v) => v.profile_id === me.id);
    try { mine ? await db.remove('suggestion_votes', mine.id) : await db.insert('suggestion_votes', { suggestion_id: i.id, profile_id: me.id }); reload(); } catch (e) { fail(e); }
  };
  const setStatus = async (i, status) => { await db.update('suggestions', i.id, { status }).catch(fail); reload(); };
  const toEvent = (i) => openEventForm(app, { type: i.category === 'sortie' ? 'sortie' : i.category === 'stage' ? 'stage' : 'animation', title: i.title, description: i.description, date: addDays(todayISO(), 14) }, reload,
    async (ev) => { await db.update('suggestions', i.id, { status: 'validee', event_id: ev.id }); reload(); });
  return html`<section class="page">
    <${PageHead} title="Boîte à idées" sub="Une envie d’animation, de sortie, de stage ou une idée pour l’écurie ? Propose-la, les autres votent 🙋">
      <button class="btn primary" onClick=${() => openIdea(app, {}, reload)}><${Icon} n="idea" /> Proposer une idée</button>
    </${PageHead}>
    <div class="toolbar"><${Seg} value=${filter} onChange=${setFilter} options=${[['ouvertes', 'En cours'], ['archive', 'Réalisées / archivées'], ['toutes', 'Toutes']]} /></div>
    ${!list.length ? html`<${Empty} icon="💡" title="Pas encore d’idée ici" text="Lance la première !" />` : html`<div class="ideas">${list.map((i) => {
      const vs = vOf(i.id); const mine = vs.some((v) => v.profile_id === me.id); const C = IDEA_CATS[i.category] || IDEA_CATS.autre; const S = IDEA_STATUS[i.status];
      return html`<article class="idea">
        <button class=${cls('vote', mine && 'on')} onClick=${() => vote(i)} aria-pressed=${mine}><span>🙋</span><b>${vs.length}</b><small>${mine ? 'partant·e' : 'je suis partant·e'}</small></button>
        <div class="idea-b">
          <div class="idea-top"><span class="idea-cat">${C.icon} ${C.label}</span><${Badge} color=${S.color}>${S.label}</${Badge}></div>
          <h3>${i.title}</h3>${i.description && html`<p>${i.description}</p>`}
          <div class="idea-foot"><${Avatar} p=${P[i.author_id]} size=${22} /><small>${P[i.author_id]?.full_name || '?'} · ${fmtDate(i.created_at.slice(0, 10), 'dm')}</small>
            ${vs.length > 0 && html`<span class="voters">${vs.slice(0, 8).map((v) => html`<${Avatar} p=${P[v.profile_id]} size=${20} />`)}</span>`}
            <span class="grow"></span>
            ${i.event_id && html`<button class="btn small" onClick=${() => openEvent(app, i.event_id, reload)}>📅 Voir l’événement</button>`}
            ${(isAdmin || i.author_id === me.id) && html`<button class="icon-btn" aria-label="Modifier" onClick=${() => openIdea(app, i, reload)}><${Icon} n="edit" size=${16} /></button>`}
          </div>
          ${isAdmin && html`<div class="idea-admin"><select value=${i.status} onChange=${(e) => setStatus(i, e.target.value)}>${Object.entries(IDEA_STATUS).map(([k, s]) => html`<option value=${k}>${s.label}</option>`)}</select>
            ${!i.event_id && html`<button class="btn small" onClick=${() => toEvent(i)}>✨ En faire un événement</button>`}</div>`}
        </div></article>`;
    })}</div>`}
  </section>`;
}
function openIdea(app, i, reload) { openModal((close) => html`<${IdeaForm} i=${i} close=${close} reload=${reload} />`); }
function IdeaForm({ i, close, reload }) {
  const app = useApp(); const f = useForm({ title: '', category: 'animation', description: '', ...i });
    const save = async (e) => { e.preventDefault(); try { const row = { title: f.v.title, category: f.v.category, description: f.v.description };
      i.id ? await db.update('suggestions', i.id, row) : await db.insert('suggestions', { ...row, author_id: app.me.id, status: 'nouvelle' }); close(); reload(); toast(i.id ? 'Modifié' : 'Merci pour l’idée ! 💡'); } catch (er) { fail(er); } };
    const del = async () => { if (await confirmBox('Supprimer cette idée ?', { ok: 'Supprimer', danger: true })) { await db.remove('suggestions', i.id).catch(fail); close(); reload(); } };
    return html`<${Modal} title=${i.id ? 'Modifier l’idée' : 'Proposer une idée'} icon="💡" close=${close} footer=${html`${i.id && html`<button class="btn ghost danger" onClick=${del}><${Icon} n="trash" size=${16} /></button>`}<span class="grow"></span><button class="btn primary" form="if">${i.id ? 'Enregistrer' : 'Proposer'}</button>`}>
      <form id="if" class="form" onSubmit=${save}>
        <div class="type-pick">${Object.entries(IDEA_CATS).map(([k, c]) => html`<button type="button" class=${cls(f.v.category === k && 'on')} style="--c:#7a5c4f" onClick=${() => f.set('category', k)}><span>${c.icon}</span>${c.label}</button>`)}</div>
        <${Field} label="Ton idée en une phrase"><input required placeholder="Ex. Une soirée galette des rois, une balade au lac…" ...${f.bind('title')} /></${Field}>
        <${Field} label="Quelques détails"><textarea rows="4" placeholder="Quand ? Pour qui ? Ce qu’il faudrait prévoir…" ...${f.bind('description')}></textarea></${Field}>
      </form></${Modal}>`;
}

// ═════════════════════ INFOS PRATIQUES ═════════════════════
export function Infos() {
  const app = useApp();
  const [posts, reload] = useData(() => db.select('posts', { order: '-created_at' }), []);
  if (!posts) return html`<section class="page"><${Loading} /></section>`;
  const ann = posts.filter((p) => p.kind === 'annonce').sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const notices = posts.filter((p) => p.kind === 'notice');
  const Post = ({ p }) => html`<article class=${cls('card post-card', p.pinned && 'pinned')}>
    <div class="pc-h"><h3>${p.pinned ? '📌 ' : ''}${p.title}</h3>${app.isAdmin && html`<button class="icon-btn" aria-label="Modifier" onClick=${() => openPost(app, p, reload)}><${Icon} n="edit" size=${16} /></button>`}</div>
    <div class="pc-body">${p.body}</div><small class="muted">${fmtDate(p.created_at.slice(0, 10), 'full')}</small></article>`;
  return html`<section class="page">
    <${PageHead} title="Infos pratiques" sub="Annonces de l’écurie et modes d’emploi (arrosage, brouette, règles de vie…).">
      ${app.isAdmin && html`<button class="btn" onClick=${() => openPost(app, { kind: 'notice' }, reload)}>＋ Mode d’emploi</button><button class="btn primary" onClick=${() => openPost(app, { kind: 'annonce' }, reload)}>＋ Annonce</button>`}
    </${PageHead}>
    <div class="info-cols"><div><h3 class="sec">📣 Annonces</h3>${ann.length ? ann.map((p) => html`<${Post} p=${p} />`) : html`<p class="muted">Pas d’annonce.</p>`}</div>
      <div><h3 class="sec">🛠️ Modes d’emploi</h3>${notices.length ? notices.map((p) => html`<${Post} p=${p} />`) : html`<p class="muted">Rien pour l’instant.</p>`}</div></div>
  </section>`;
}
function openPost(app, p, reload) { openModal((close) => html`<${PostForm} p=${p} close=${close} reload=${reload} />`); }
function PostForm({ p, close, reload }) {
  const app = useApp(); const f = useForm({ title: '', body: '', pinned: false, ...p });
    const save = async (e) => { e.preventDefault(); try { const row = { kind: p.kind, title: f.v.title, body: f.v.body, pinned: !!f.v.pinned }; p.id ? await db.update('posts', p.id, row) : await db.insert('posts', { ...row, author_id: app.me.id }); close(); reload(); } catch (er) { fail(er); } };
    const del = async () => { if (await confirmBox('Supprimer ?', { ok: 'Supprimer', danger: true })) { await db.remove('posts', p.id).catch(fail); close(); reload(); } };
    return html`<${Modal} title=${p.kind === 'notice' ? 'Mode d’emploi' : 'Annonce'} close=${close} footer=${html`${p.id && html`<button class="btn ghost danger" onClick=${del}><${Icon} n="trash" size=${16} /></button>`}<span class="grow"></span><button class="btn primary" form="pf">Publier</button>`}>
      <form id="pf" class="form" onSubmit=${save}><${Field} label="Titre"><input required ...${f.bind('title')} /></${Field}>
        <${Field} label="Texte" hint="Les retours à la ligne sont conservés : pratique pour les étapes 1. 2. 3."><textarea rows="8" ...${f.bind('body')}></textarea></${Field}>
        ${p.kind === 'annonce' && html`<label class="check"><input type="checkbox" checked=${!!f.v.pinned} onChange=${(e) => f.set('pinned', e.target.checked)} /> Épingler en haut de l’accueil</label>`}
      </form></${Modal}>`;
}
