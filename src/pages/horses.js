import { html, useState, useMemo, useRef } from '../lib.js';
import { db, uploadPhoto } from '../db.js';
import { useApp, Icon, Avatar, HorseAvatar, Modal, openModal, confirmBox, toast, fail, useForm, Field, Seg, ChipPick, Badge, useData, PageHead, Empty, Loading, Tabs } from '../ui.js';
import { offerCalendar } from '../calendar.js';
import { DocumentsCard } from './documents.js';
import { weekStart, parseISO, DOW, MONTHS, todayISO, addDays, diffDays, fmtDate, fmtTime, relDays, age, HEALTH_TYPES, TRACKED, STATE_META, healthStatus, PENSIONS, SEXES, cls, norm, resizeImage } from '../util.js';

// ── Pastilles de santé ───────────────────────────────────────
export function HealthDots({ evts, size = 'md' }) {
  return html`<span class=${'hdots ' + size}>${TRACKED.map((t) => {
    const s = healthStatus(evts, t); const T = HEALTH_TYPES[t];
    const tip = `${T.label} : ${STATE_META[s.state].label}${s.last ? ' — dernier ' + fmtDate(s.last.date) : ''}${s.next ? ' — prochain ' + fmtDate(s.next) : ''}`;
    return html`<span class=${'hdot ' + s.state} title=${tip} style=${`--c:${STATE_META[s.state].color}`}>${T.icon}</span>`;
  })}</span>`;
}

// ═════════════════════ LISTE DES CHEVAUX ═════════════════════
export function Horses() {
  const app = useApp(); const { isAdmin, horses, myHorseIds, me } = app;
  const [scope, setScope] = useState(isAdmin || !myHorseIds.length ? 'all' : 'mine');
  const [q, setQ] = useState('');
  const [health] = useData(() => (isAdmin ? db.select('health_events') : myHorseIds.length ? db.select('health_events', { in: { horse_id: myHorseIds } }) : Promise.resolve([])), [horses.length]);
  const archived = horses.filter((h) => h.departure_date);
  const list = horses.filter((h) => (scope === 'archives' ? !!h.departure_date : !h.departure_date && (scope === 'all' || myHorseIds.includes(h.id))) && (!q || norm(h.name + ' ' + app.ownerName(h)).includes(norm(q))));
  const byHorse = useMemo(() => { const m = {}; for (const e of health || []) (m[e.horse_id] ||= []).push(e); return m; }, [health]);
  return html`<section class="page">
    <${PageHead} title="Les chevaux" sub=${`${horses.filter((h) => !h.departure_date).length} chevaux à l’écurie`}>
      ${(isAdmin || me.role === 'proprietaire') && html`<button class="btn primary" onClick=${() => openHorseForm(app, {})}><${Icon} n="plus" /> Ajouter un cheval</button>`}
    </${PageHead}>
    <div class="toolbar">
      ${(myHorseIds.length > 0 || (isAdmin && archived.length > 0)) && html`<${Seg} value=${scope} onChange=${setScope} options=${[...(myHorseIds.length ? [['mine', 'Mes chevaux']] : []), ['all', 'Tous'], ...(isAdmin && archived.length ? [['archives', `🗄️ Archives (${archived.length})`]] : [])]} />`}
      <label class="search"><${Icon} n="search" size=${18} /><input placeholder="Rechercher un cheval, un proprio…" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
    </div>
    ${!list.length ? html`<${Empty} title="Aucun cheval ici" text=${scope === 'mine' ? 'Ajoute ton cheval avec le bouton « Ajouter un cheval ».' : 'Essaie une autre recherche.'} />` : html`
    <div class="horse-grid">${list.map((h) => {
      const see = app.canSeeHealth(h);
      const riders = app.riders.filter((r) => r.horse_id === h.id);
      return html`<a class=${'horse-card' + (h.departure_date ? ' archived' : '')} href=${'#cheval-' + h.id}>
        <${HorseAvatar} h=${h} size=${64} />
        <div class="hc-body"><strong>${h.name}</strong><small>${app.ownerName(h)}${riders.length ? ' · ' + riders.map((r) => r.kind + ' ' + (app.P[r.profile_id]?.full_name || '')).join(', ') : ''}</small>
          ${see ? html`<${HealthDots} evts=${byHorse[h.id] || []} size="sm" />` : html`<small class="muted">${[h.breed, SEXES[h.sex], age(h.birth_date) != null && age(h.birth_date) + ' ans'].filter(Boolean).join(' · ')}</small>`}
        </div>${myHorseIds.includes(h.id) && html`<span class="mine-tag">${h.owner_id === me.id ? 'à moi' : 'je monte'}</span>`}</a>`;
    })}</div>`}
  </section>`;
}

// ═════════════════════ FICHE CHEVAL ═════════════════════
export function HorseDetail({ id }) {
  const app = useApp(); const h = app.H[id];
  const [tab, setTab] = useState('sante');
  const [filter, setFilter] = useState('all');
  const can = h && app.canManageHorse(h); const see = h && app.canSeeHealth(h);
  const [evts, reload] = useData(() => (see ? db.select('health_events', { eq: { horse_id: id }, order: '-date' }) : Promise.resolve([])), [id, see]);
  const fileRef = useRef();
  if (!h) return html`<section class="page"><${Empty} title="Cheval introuvable"><a class="btn" href="#chevaux">Retour</a></${Empty}></section>`;
  const riders = app.riders.filter((r) => r.horse_id === id);
  const onPhoto = async (e) => { const file = e.target.files[0]; if (!file) return; try { const photo = await uploadPhoto(id, await resizeImage(file)); await db.update('horses', id, { photo }); await app.reloadBase(); toast('Photo mise à jour 📸'); } catch (er) { fail(er); } };
  const shown = (evts || []).filter((e) => filter === 'all' || e.type === filter);
  const years = {}; for (const e of shown) (years[e.date.slice(0, 4)] ||= []).push(e);

  return html`<section class="page horse-page">
    <a class="back" href="#chevaux"><${Icon} n="left" size=${18} /> Chevaux</a>
    ${h.departure_date && html`<div class="archive-banner">🗄️ <span><b>Cheval archivé</b> — sorti le ${fmtDate(h.departure_date, 'full')}${h.destination ? ' vers ' + h.destination : ''}. Son historique reste consultable et figure au registre d’élevage.</span>
      ${app.isAdmin && html`<button class="btn small" onClick=${async () => { if (await confirmBox(`Réactiver ${h.name} ? (retour à l’écurie)`, { ok: 'Réactiver' })) { await db.update('horses', h.id, { departure_date: null, destination: '' }).catch(fail); await app.reloadBase(); toast(h.name + ' est de retour 🐴'); } }}>Réactiver</button>`}</div>`}
    <div class="horse-hero">
      <div class="hh-photo" onClick=${() => can && fileRef.current.click()} title=${can ? 'Changer la photo' : ''}>
        <${HorseAvatar} h=${h} size=${120} />${can && html`<span class="hh-cam"><${Icon} n="camera" size=${18} /></span>`}
        <input type="file" accept="image/*" ref=${fileRef} hidden onChange=${onPhoto} />
      </div>
      <div class="hh-info">
        <h1>${h.name}</h1>
        <p class="sub">${[h.breed, SEXES[h.sex], h.robe, age(h.birth_date) != null && age(h.birth_date) + ' ans', h.height && h.height + ' cm'].filter(Boolean).join(' · ')}</p>
        <div class="hh-people">
          <span class="person-pill"><${Avatar} p=${app.P[h.owner_id]} name=${app.ownerName(h)} size=${22} /> Propriétaire : <b>${app.ownerName(h)}</b></span>
          ${riders.map((r) => html`<span class="person-pill"><${Avatar} p=${app.P[r.profile_id]} size=${22} /> ${r.kind} : <b>${app.P[r.profile_id]?.full_name}</b>${r.days && html` <small>(${r.days})</small>`}</span>`)}
          ${h.pension && html`<${Badge} color="#7a5c4f">${PENSIONS[h.pension]}</${Badge}>`}
        </div>
      </div>
      <div class="hh-actions">
        ${can && html`<button class="btn ghost" onClick=${() => openHorseForm(app, h)}><${Icon} n="edit" size=${16} /> Modifier la fiche</button>`}
        ${see && html`<button class="btn ghost" onClick=${() => import('../pdf.js').then((m) => m.horsePdf(app, h)).catch(fail)}><${Icon} n="download" size=${16} /> Carnet en PDF</button>`}
        ${app.isAdmin && !h.departure_date && html`<button class="btn ghost" onClick=${() => openArchiveHorse(app, h)}>🗄️ Archiver</button>`}
      </div>
    </div>

    ${see && evts && !h.departure_date && html`<div class="status-tiles">${TRACKED.map((t) => {
      const s = healthStatus(evts, t); const T = HEALTH_TYPES[t]; const M = STATE_META[s.state];
      return html`<button class=${'tile ' + s.state} style=${`--c:${M.color}`} onClick=${() => { setTab('sante'); setFilter(t); }}>
        <span class="tile-ic">${T.icon}</span><span class="tile-l">${T.label}</span>
        <span class="tile-s">${M.label}</span>
        <small>${s.last ? 'Fait ' + relDays(diffDays(todayISO(), s.last.date)) : 'Jamais renseigné'}</small>
        ${s.next && html`<small>${s.planned ? 'RDV ' : 'Prochain '}${fmtDate(s.next)}</small>`}</button>`;
    })}</div>`}

    <${Tabs} value=${tab} onChange=${setTab} tabs=${[...(see ? [['sante', '🩺 Carnet de santé']] : []), ['fiche', '🪪 Identité'], ['ration', '🥕 Ration'], ...(can ? [['docs', '📄 Contrat & documents'], ['cavaliers', '🏇 DP / TP']] : [])]} />

    ${tab === 'sante' && see && html`<div class="card">
      <div class="card-h"><div class="filter-chips">
        <button class=${cls('chip', filter === 'all' && 'on')} onClick=${() => setFilter('all')}>Tout</button>
        ${Object.entries(HEALTH_TYPES).map(([k, T]) => html`<button class=${cls('chip', filter === k && 'on')} onClick=${() => setFilter(k)}>${T.icon} ${T.label}</button>`)}
      </div><button class="btn primary" onClick=${() => app.openHealth({ horse_ids: [id], type: filter !== 'all' && (app.isAdmin || !HEALTH_TYPES[filter]?.adminOnly) ? filter : (app.isAdmin ? 'vaccin' : 'vermifuge') }, reload)}><${Icon} n="plus" /> Ajouter</button></div>
      ${!evts ? html`<${Loading} />` : !shown.length ? html`<${Empty} icon="📖" title="Rien de noté ici" text="Ajoute un vaccin, un passage du maréchal, un petit bobo… tout l’historique reste ici." />` : html`
      <div class="timeline">${Object.keys(years).sort().reverse().map((y) => html`<div class="tl-year">${y}</div>${years[y].map((e) => html`<${HealthItem} e=${e} reload=${reload} />`)}`)}</div>`}
    </div>`}

    ${tab === 'fiche' && html`<div class="card"><dl class="kv">
      ${[['Nom', h.name], ['Sexe', SEXES[h.sex]], ['Né·e le', fmtDate(h.birth_date)], ['Race', h.breed], ['Robe', h.robe], ['Taille', h.height && h.height + ' cm'],
         ['N° SIRE', h.sire], ['UELN', h.ueln], ['Transpondeur', h.transponder], ['Formule', PENSIONS[h.pension]], ['Arrivé·e le', fmtDate(h.arrival_date)], ['Provenance', h.origin],
         ...(h.departure_date ? [['Sorti·e le', fmtDate(h.departure_date)], ['Destination', h.destination]] : [])].map(([k, v]) => html`<dt>${k}</dt><dd>${v || '—'}</dd>`)}
    </dl>${h.notes && html`<div class="note-box"><b>Caractère, habitudes, à savoir :</b><p>${h.notes}</p></div>`}</div>`}

    ${tab === 'ration' && html`<${RationCard} h=${h} can=${can} />`}
    ${tab === 'cavaliers' && can && html`<${RidersCard} h=${h} />`}
    ${tab === 'docs' && can && html`<${DocumentsCard} h=${h} />`}
  </section>`;
}

function HealthItem({ e, reload }) {
  const app = useApp(); const T = HEALTH_TYPES[e.type] || HEALTH_TYPES.autre;
  const del = async () => { if (await confirmBox('Supprimer cette entrée du carnet ?', { ok: 'Supprimer', danger: true })) { await db.remove('health_events', e.id).catch(fail); reload(); } };
  return html`<div class=${cls('tl-item', e.status === 'prevu' && 'planned')}>
    <span class="tl-ic">${T.icon}</span>
    <div class="tl-body">
      <div class="tl-top"><b>${T.label}</b><span class="muted">${fmtDate(e.date, 'full')}${e.time ? ' à ' + fmtTime(e.time) : ''}</span>${e.status === 'prevu' && html`<${Badge} color="#3b6ea8">prévu</${Badge}>`}</div>
      ${(e.practitioner || e.product || e.lot) && html`<div class="tl-meta">${e.practitioner && html`<span>👤 ${e.practitioner}</span>`}${e.product && html`<span>🧪 ${e.product}</span>`}${e.lot && html`<span>Lot ${e.lot}</span>`}</div>`}
      ${e.notes && html`<p class="tl-notes">${e.notes}</p>`}
      ${e.next_due && html`<small class="muted">Prochain : ${fmtDate(e.next_due)}</small>`}
    </div>
    <div class="tl-act">
      ${e.status === 'prevu' && (!T.adminOnly || app.isAdmin) && html`<button class="icon-btn" title="Ajouter à mon agenda" onClick=${() => offerCalendar({ uid: e.id + '@lbg', title: `${T.label} — ${app.H[e.horse_id]?.name}`, date: e.date, start: e.time, description: [e.practitioner, e.notes].filter(Boolean).join('\n') })}>📅</button>
        <button class="btn small" onClick=${async () => { await db.update('health_events', e.id, { status: 'fait' }).catch(fail); reload(); toast('Marqué comme fait ✅'); }}>Fait ✓</button>`}
      ${T.adminOnly && !app.isAdmin ? html`<span class="lock" title="Les vaccins sont saisis par l’écurie">🔒</span>` : html`
      <button class="icon-btn" aria-label="Modifier" onClick=${() => app.openHealth(e, reload)}><${Icon} n="edit" size=${16} /></button>
      <button class="icon-btn" aria-label="Supprimer" onClick=${del}><${Icon} n="trash" size=${16} /></button>`}
    </div></div>`;
}

function RationCard({ h, can }) {
  const app = useApp();
  const f = useForm({ ration_morning: h.ration_morning || '', ration_evening: h.ration_evening || '', supplements: h.supplements || '' });
  const save = async (e) => { e.preventDefault(); try { await db.update('horses', h.id, f.v); await app.reloadBase(); toast('Ration enregistrée 🥕'); } catch (er) { fail(er); } };
  return html`<form class="card form" onSubmit=${save}>
    <div class="ration-grid">
      <${Field} label="☀️ Matin"><textarea rows="3" disabled=${!can} ...${f.bind('ration_morning')}></textarea></${Field}>
      <${Field} label="🌙 Soir"><textarea rows="3" disabled=${!can} ...${f.bind('ration_evening')}></textarea></${Field}>
      <${Field} label="➕ Compléments / remarques"><textarea rows="3" disabled=${!can} ...${f.bind('supplements')}></textarea></${Field}>
    </div>
    ${can && html`<div class="right"><button class="btn primary">Enregistrer</button></div>`}
  </form>`;
}

function RidersCard({ h }) {
  const app = useApp(); const riders = app.riders.filter((r) => r.horse_id === h.id);
  const f = useForm({ profile_id: '', kind: 'DP', days: '' });
  const add = async (e) => { e.preventDefault(); if (!f.v.profile_id) return; try { await db.insert('horse_riders', { horse_id: h.id, ...f.v }); await app.reloadBase(); f.setV({ profile_id: '', kind: 'DP', days: '' }); toast('Ajouté·e'); } catch (er) { fail(er); } };
  return html`<div class="card">
    ${!riders.length && html`<p class="muted">Aucune demi-pension ou tiers de pension pour ${h.name}.</p>`}
    <ul class="plist">${riders.map((r) => html`<li><span class="pname"><${Avatar} p=${app.P[r.profile_id]} size=${28} /><span><b>${app.P[r.profile_id]?.full_name}</b> <small>${r.kind}${r.days ? ' · ' + r.days : ''}</small></span></span><span class="grow"></span>
      <button class="icon-btn" aria-label="Retirer" onClick=${async () => { if (await confirmBox('Retirer ce cavalier ?', { ok: 'Retirer', danger: true })) { await db.remove('horse_riders', r.id).catch(fail); app.reloadBase(); } }}><${Icon} n="trash" size=${16} /></button></li>`)}</ul>
    <form class="inline-form" onSubmit=${add}>
      <select ...${f.bind('profile_id')}><option value="">Choisir un cavalier…</option>${app.members.map((p) => html`<option value=${p.id}>${p.full_name}</option>`)}</select>
      <${Seg} small value=${f.v.kind} onChange=${(k) => f.set('kind', k)} options=${[['DP', 'Demi-pension'], ['TP', 'Tiers']]} />
      <input placeholder="Jours (ex. mar, sam)" ...${f.bind('days')} />
      <button class="btn">Ajouter</button>
    </form>
    <p class="hint">💡 Les DP/TP voient le carnet de santé du cheval et peuvent y noter un bobo.</p>
  </div>`;
}

// ═════════════════════ FORMULAIRE CHEVAL ═════════════════════
export function openHorseForm(app, h) { openModal((close) => html`<${HorseForm} h=${h} close=${close} />`); }
function HorseForm({ h, close }) {
  const app = useApp(); const editing = !!h.id;
  const f = useForm({ name: '', sex: 'hongre', birth_date: '', breed: '', robe: '', height: '', sire: '', ueln: '', transponder: '', pension: 'base', arrival_date: todayISO(), origin: '', departure_date: '', destination: '', notes: '', owner_id: app.isAdmin ? '' : app.me.id, owner_label: '', ...h });
  const save = async (e) => {
    e.preventDefault();
    const row = { ...f.v }; ['birth_date', 'arrival_date', 'departure_date'].forEach((k) => { if (!row[k]) row[k] = null; }); row.height = row.height ? Number(row.height) : null; row.owner_id = row.owner_id || null;
    delete row.id; delete row.created_at;
    try {
      if (editing) await db.update('horses', h.id, row); else { const [c] = await db.insert('horses', row); location.hash = 'cheval-' + c.id; }
      await app.reloadBase(); close(); toast(editing ? 'Fiche mise à jour' : `Bienvenue ${row.name} ! 🐴`);
    } catch (er) { fail(er); }
  };
  const del = async () => { if (await confirmBox(`Supprimer définitivement ${h.name} et tout son carnet ? (Pour un départ de l’écurie, renseigne plutôt la date de sortie : il reste dans le registre.)`, { ok: 'Supprimer', danger: true })) { await db.remove('horses', h.id).catch(fail); await app.reloadBase(); close(); location.hash = 'chevaux'; } };
  return html`<${Modal} wide title=${editing ? 'Fiche de ' + h.name : 'Nouveau cheval'} close=${close}
    footer=${html`${editing && app.isAdmin && html`<button class="btn ghost danger" onClick=${del}><${Icon} n="trash" size=${16} /></button>`}<span class="grow"></span><button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="hf">Enregistrer</button>`}>
    <form id="hf" class="form" onSubmit=${save}>
      <h3 class="sec">🐴 Le cheval</h3>
      <div class="row3">
        <${Field} label="Nom *"><input required ...${f.bind('name')} /></${Field}>
        <${Field} label="Sexe"><select ...${f.bind('sex')}>${Object.entries(SEXES).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></${Field}>
        <${Field} label="Date de naissance"><input type="date" ...${f.bind('birth_date')} /></${Field}>
        <${Field} label="Race"><input list="races" ...${f.bind('breed')} /></${Field}>
        <${Field} label="Robe"><input ...${f.bind('robe')} /></${Field}>
        <${Field} label="Taille (cm)"><input type="number" ...${f.bind('height')} /></${Field}>
      </div>
      <datalist id="races">${['Selle Français', 'Pur-sang', 'Pur-sang arabe', 'Anglo-arabe', 'Trotteur Français', 'Connemara', 'PRE', 'Lusitanien', 'Quarter Horse', 'Haflinger', 'Poney Français de Selle', 'Origine non constatée'].map((r) => html`<option value=${r} />`)}</datalist>
      <h3 class="sec">🪪 Identification <small class="muted">(livret / carte SIRE)</small></h3>
      <div class="row3">
        <${Field} label="N° SIRE"><input ...${f.bind('sire')} /></${Field}>
        <${Field} label="UELN"><input ...${f.bind('ueln')} /></${Field}>
        <${Field} label="N° transpondeur (puce)"><input ...${f.bind('transponder')} /></${Field}>
      </div>
      <h3 class="sec">🏡 À l’écurie</h3>
      <div class="row3">
        ${app.isAdmin ? html`<${Field} label="Propriétaire (compte)"><select ...${f.bind('owner_id')}><option value="">— pas encore de compte —</option>${app.members.map((p) => html`<option value=${p.id}>${p.full_name}</option>`)}</select></${Field}>
          <${Field} label="Nom propriétaire (si pas de compte)"><input ...${f.bind('owner_label')} /></${Field}>` : ''}
        <${Field} label="Formule"><select ...${f.bind('pension')}>${Object.entries(PENSIONS).map(([k, l]) => html`<option value=${k}>${l}</option>`)}</select></${Field}>
        <${Field} label="Date d’arrivée"><input type="date" ...${f.bind('arrival_date')} /></${Field}>
        <${Field} label="Provenance"><input placeholder="Ancienne écurie, éleveur…" ...${f.bind('origin')} /></${Field}>
        ${editing && html`<${Field} label="Date de sortie"><input type="date" ...${f.bind('departure_date')} /></${Field}>
          <${Field} label="Destination"><input ...${f.bind('destination')} /></${Field}>`}
      </div>
      <${Field} label="Caractère, habitudes, à savoir"><textarea rows="3" placeholder="Ex. n’aime pas la tondeuse, porte une couverture sous 5°C, tique au montoir…" ...${f.bind('notes')}></textarea></${Field}>
    </form></${Modal}>`;
}

// ═════════════════════ FORMULAIRE SOIN ═════════════════════
export function HealthForm({ init, close, reload }) {
  const app = useApp(); const editing = !!init.id;
  const manageable = app.horses.filter((h) => !h.departure_date && app.canSeeHealth(h));
  const f = useForm({ type: app.isAdmin ? 'vaccin' : 'vermifuge', date: todayISO(), time: '', status: 'fait', practitioner: '', product: '', lot: '', notes: '', next_due: '', horse_ids: init.horse_id ? [init.horse_id] : manageable.length === 1 ? [manageable[0].id] : [], ...init, next_due: init.next_due || '', time: init.time?.slice(0, 5) || '' });
  const T = HEALTH_TYPES[f.v.type];
  const auto = T.every ? addDays(f.v.date, T.every) : '';
  const prac = { marechal: 'Kevin Arzul', osteo: 'Julie Carnus' };
  const save = async (e) => {
    e.preventDefault();
    if (!f.v.horse_ids.length) return toast('Choisis au moins un cheval', 'err');
    const base = { type: f.v.type, date: f.v.date, time: f.v.time || null, status: f.v.status, practitioner: f.v.practitioner, product: f.v.product, lot: f.v.lot, notes: f.v.notes, next_due: f.v.next_due || null };
    try {
      if (editing) await db.update('health_events', init.id, base);
      else await db.insert('health_events', f.v.horse_ids.map((horse_id) => ({ ...base, horse_id })));
      close(); reload?.();
      if (f.v.status === 'prevu' && f.v.date >= todayISO()) offerCalendar({ uid: 'soin-' + f.v.type + f.v.date + '@lbg', title: `${T.label} — ${f.v.horse_ids.map((h) => app.H[h]?.name).join(', ')}`, date: f.v.date, start: f.v.time || null, description: [f.v.practitioner, f.v.notes].filter(Boolean).join('\n') }, { auto: true, intro: 'RDV ajouté au planning 📅' });
      else toast(f.v.status === 'prevu' ? 'RDV ajouté au planning 📅' : 'Ajouté au carnet ✅');
    } catch (er) { fail(er); }
  };
  return html`<${Modal} title=${editing ? 'Modifier' : 'Ajouter au carnet de santé'} close=${close}
    footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="hsf">Enregistrer</button>`}>
    <form id="hsf" class="form" onSubmit=${save}>
      <div class="htype-grid">${Object.entries(HEALTH_TYPES).filter(([k, x]) => app.isAdmin || !x.adminOnly).map(([k, x]) => html`<button type="button" class=${cls(f.v.type === k && 'on')} onClick=${() => { f.set('type', k); if (!f.v.practitioner && prac[k]) f.set('practitioner', prac[k]); }}><span>${x.icon}</span>${x.label}</button>`)}</div>
      <${Seg} value=${f.v.status} onChange=${(k) => f.set('status', k)} options=${[['fait', '✅ C’est fait'], ['prevu', '📅 RDV prévu']]} />
      ${!app.isAdmin && html`<p class="hint" style="margin:0">💉 Les vaccins et leurs rappels sont saisis par l’écurie (Nathalie).</p>`}
      ${!editing && html`<${Field} label=${manageable.length > 1 ? 'Cheval / chevaux concernés' : 'Cheval'} hint=${manageable.length > 3 ? 'Astuce : sélectionne plusieurs chevaux pour une tournée du maréchal ou une campagne de vaccins.' : ''}>
        <${ChipPick} value=${f.v.horse_ids} onChange=${(v) => f.set('horse_ids', v)} options=${manageable.map((h) => [h.id, h.name])} /></${Field}>`}
      <div class="row3">
        <${Field} label="Date"><input type="date" required ...${f.bind('date')} /></${Field}>
        <${Field} label=${f.v.status === 'prevu' ? 'Heure du RDV' : 'Heure (facultatif)'}><input type="time" ...${f.bind('time')} /></${Field}>
        <${Field} label="Praticien"><input list="pracs" placeholder="Vétérinaire, maréchal…" ...${f.bind('practitioner')} /></${Field}>
      </div>
      <datalist id="pracs">${app.contacts.map((c) => html`<option value=${c.name} />`)}</datalist>
      ${T.lot && html`<div class="row2"><${Field} label="Produit"><input placeholder=${f.v.type === 'vaccin' ? 'Ex. Equip FT, Proteqflu-Te…' : 'Ex. Equest Pramox…'} ...${f.bind('product')} /></${Field}><${Field} label="N° de lot"><input ...${f.bind('lot')} /></${Field}></div>`}
      ${!T.lot && ['veto', 'bobo', 'autre'].includes(f.v.type) && html`<${Field} label="Traitement / produit"><input ...${f.bind('product')} /></${Field}>`}
      <${Field} label="Notes"><textarea rows="3" placeholder=${f.v.type === 'bobo' ? 'Où, comment, comment ça évolue…' : 'Observations, ordonnance, conseils…'} ...${f.bind('notes')}></textarea></${Field}>
      ${T.every && f.v.status === 'fait' && html`<${Field} label="Prochain rappel" hint=${'Par défaut : ' + fmtDate(auto) + ' (tous les ' + (T.every >= 300 ? 'ans' : Math.round(T.every / 7) + ' semaines') + '). Change-le si le praticien a dit autre chose.'}><input type="date" ...${f.bind('next_due')} /></${Field}>`}
    </form></${Modal}>`;
}

// ═════════════════════ TABLEAU SANITAIRE (admin) ═════════════════════
/** Pour chaque cheval et chaque suivi : prochaine échéance, RDV prévu, retard. */
function buildDues(app, evts) {
  const by = {}; for (const e of evts) (by[e.horse_id] ||= []).push(e);
  const horses = app.horses.filter((h) => !h.departure_date);
  const rows = horses.map((h) => ({ h, st: Object.fromEntries(TRACKED.map((t) => [t, healthStatus(by[h.id] || [], t)])) }));
  const dues = [];
  for (const { h, st } of rows) for (const t of TRACKED) {
    const s = st[t];
    dues.push({ h, t, s, date: s.planned ? s.planned.date : s.next, planned: !!s.planned, late: !s.planned && s.state === 'late', none: s.state === 'none' && !s.planned });
  }
  return { rows, dues };
}
const T_COLOR = (t) => HEALTH_TYPES[t]?.color || '#7a5c4f';

export function SanteBoard() {
  const app = useApp();
  const [evts, reload] = useData(() => db.select('health_events'), []);
  const [view, setView] = useState('calendrier');
  const [theme, setTheme] = useState('marechal');
  if (!evts) return html`<section class="page"><${Loading} /></section>`;
  const { rows, dues } = buildDues(app, evts);
  const lateBy = Object.fromEntries(TRACKED.map((t) => [t, dues.filter((d) => d.t === t && d.late)]));
  return html`<section class="page">
    <${PageHead} title="Tableau sanitaire" sub="Vaccins, vermifuges, maréchal, dentiste, ostéo : repère les lots de chevaux à faire ensemble.">
      <button class="btn primary" onClick=${() => app.openHealth({ status: 'prevu' }, reload)}><${Icon} n="plus" /> Programmer un RDV</button>
    </${PageHead}>
    <div class="toolbar">
      <${Seg} value=${view} onChange=${setView} options=${[['calendrier', '🗓️ Calendrier'], ['theme', '📋 Par thème'], ['chevaux', '🐴 Par cheval']]} />
    </div>
    <div class="late-bar">${TRACKED.map((t) => html`<button class=${cls('late-pill', !lateBy[t].length && 'zero')} style=${`--c:${T_COLOR(t)}`} onClick=${() => { setTheme(t); setView('theme'); }}>
      <span>${HEALTH_TYPES[t].icon}</span><b>${HEALTH_TYPES[t].label}</b><small>${lateBy[t].length ? `${lateBy[t].length} à programmer (retard)` : 'rien en retard'}</small></button>`)}</div>
    ${view === 'chevaux' && html`<${ByHorse} rows=${rows} evts=${evts} reload=${reload} />`}
    ${view === 'theme' && html`<${ByTheme} dues=${dues} theme=${theme} setTheme=${setTheme} reload=${reload} />`}
    ${view === 'calendrier' && html`<${CalendarView} dues=${dues} evts=${evts} reload=${reload} openTheme=${(t) => { setTheme(t); setView('theme'); }} />`}
  </section>`;
}

function ByHorse({ rows, evts, reload }) {
  const app = useApp(); const [only, setOnly] = useState('all');
  const count = (s) => rows.reduce((n, r) => n + TRACKED.filter((t) => r.st[t].state === s).length, 0);
  const shown = only === 'all' ? rows : rows.filter((r) => TRACKED.some((t) => r.st[t].state === only));
  const upcoming = evts.filter((e) => e.status === 'prevu' && e.date >= todayISO()).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 12);
  return html`
    <div class="kpis">${['late', 'soon', 'planned', 'ok'].map((s) => html`<button class=${cls('kpi', only === s && 'on')} style=${`--c:${STATE_META[s].color}`} onClick=${() => setOnly(only === s ? 'all' : s)}><b>${count(s)}</b><span>${STATE_META[s].label}</span></button>`)}</div>
    <div class="card scroll-x"><table class="matrix">
      <thead><tr><th>Cheval</th>${TRACKED.map((t) => html`<th>${HEALTH_TYPES[t].icon}<br />${HEALTH_TYPES[t].label}</th>`)}</tr></thead>
      <tbody>${shown.map(({ h, st }) => html`<tr>
        <th><a href=${'#cheval-' + h.id} class="mx-h"><${HorseAvatar} h=${h} size=${28} /><span>${h.name}<small>${app.ownerName(h)}</small></span></a></th>
        ${TRACKED.map((t) => { const s = st[t]; return html`<td><button class=${'cell ' + s.state} style=${`--c:${STATE_META[s.state].color}`} title=${STATE_META[s.state].label} onClick=${() => app.openHealth({ horse_ids: [h.id], type: t }, reload)}>
          <b>${s.last ? fmtDate(s.last.date, 'yy') : '—'}</b><small>${s.planned ? '📅 ' + fmtDate(s.planned.date, 'yy') : s.next ? '→ ' + fmtDate(s.next, 'yy') : ''}</small></button></td>`; })}
      </tr>`)}</tbody></table></div>
    <p class="hint">Clique une case pour noter un soin. <span style="color:#3f8a5a">● à jour</span> · <span style="color:#d38b1f">● à prévoir bientôt</span> · <span style="color:#c2453d">● en retard</span> · <span style="color:#3b6ea8">● RDV prévu</span>.</p>
    ${upcoming.length > 0 && html`<div class="card"><h3>📅 Prochains RDV</h3><ul class="plist">${upcoming.map((e) => html`<li><span>${HEALTH_TYPES[e.type].icon}</span><b>${fmtDate(e.date, 'long')}${e.time ? ' · ' + fmtTime(e.time) : ''}</b><span>${HEALTH_TYPES[e.type].label} — ${app.H[e.horse_id]?.name}</span><span class="grow muted">${e.practitioner}</span></li>`)}</ul></div>`}`;
}

// ── Vue par thème : chevaux triés par date et regroupés en lots (semaine) ──
function ByTheme({ dues, theme, setTheme, reload }) {
  const app = useApp(); const today = todayISO();
  const [sort, setSort] = useState('date'); const [sel, setSel] = useState([]);
  const list = dues.filter((d) => d.t === theme);
  const T = HEALTH_TYPES[theme]; const c = T_COLOR(theme);
  const groups = [];
  if (sort === 'date') {
    const late = list.filter((d) => d.late).sort((a, b) => a.date.localeCompare(b.date));
    if (late.length) groups.push({ key: 'late', title: '⚠️ En retard — à programmer', items: late, late: true });
    const byWeek = {};
    for (const d of list.filter((x) => !x.late && !x.none).sort((a, b) => a.date.localeCompare(b.date))) (byWeek[weekStart(d.date)] ||= []).push(d);
    for (const [w, items] of Object.entries(byWeek)) groups.push({ key: w, title: `Semaine du ${fmtDate(w, 'long')}`, sub: w <= today && today <= addDays(w, 6) ? 'cette semaine' : relDays(diffDays(today, w)), items, week: w });
    const none = list.filter((x) => x.none);
    if (none.length) groups.push({ key: 'none', title: 'Jamais renseigné', items: none, none: true });
  } else groups.push({ key: 'all', title: 'Tous les chevaux', items: [...list].sort((a, b) => a.h.name.localeCompare(b.h.name)) });
  const toggle = (id) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const program = (ids, date) => app.openHealth({ type: theme, status: 'prevu', horse_ids: ids, date: date && date > today ? date : today, practitioner: { marechal: 'Kevin Arzul', osteo: 'Julie Carnus' }[theme] || '' }, () => { setSel([]); reload(); });
  return html`
    <div class="theme-tabs">${TRACKED.map((t) => html`<button class=${cls(theme === t && 'on')} style=${`--c:${T_COLOR(t)}`} onClick=${() => { setTheme(t); setSel([]); }}><span>${HEALTH_TYPES[t].icon}</span>${HEALTH_TYPES[t].label}</button>`)}</div>
    <div class="toolbar"><${Seg} small value=${sort} onChange=${setSort} options=${[['date', 'Trier par date (lots)'], ['cheval', 'Trier par cheval']]} />
      <small class="muted">Rappel par défaut : tous les ${T.every >= 300 ? 'ans' : Math.round(T.every / 7) + ' semaines'}</small></div>
    ${groups.map((g) => { const toPlan = g.items.filter((d) => !d.planned);
      return html`<div class=${cls('lot', g.late && 'late')} style=${`--c:${c}`}>
        <div class="lot-h"><div><b>${g.title}</b>${g.sub && html`<small> · ${g.sub}</small>`}<small> · ${g.items.length} cheva${g.items.length > 1 ? 'ux' : 'l'}</small></div>
          ${toPlan.length > 0 && !g.none && sort === 'date' && html`<button class="btn small lot-btn" onClick=${() => program(toPlan.map((d) => d.h.id), g.week)}>📅 Programmer ce lot (${toPlan.length})</button>`}</div>
        ${g.items.map((d) => html`<div class=${cls('lot-row', sel.includes(d.h.id) && 'on')}>
          <input type="checkbox" aria-label=${'Sélectionner ' + d.h.name} checked=${sel.includes(d.h.id)} onChange=${() => toggle(d.h.id)} />
          <a href=${'#cheval-' + d.h.id} class="mx-h"><${HorseAvatar} h=${d.h} size=${30} /><span>${d.h.name}<small>${app.ownerName(d.h)}</small></span></a>
          <span class="lr-last"><small>Dernier</small>${d.s.last ? fmtDate(d.s.last.date) : '—'}</span>
          <span class="lr-next"><small>${d.planned ? 'RDV prévu' : 'Échéance'}</small><b>${d.date ? fmtDate(d.date) : '—'}</b>${d.planned && d.s.planned.time ? ' ' + fmtTime(d.s.planned.time) : ''}</span>
          <${Badge} color=${STATE_META[d.s.state].color}>${d.planned ? '📅 prévu' : STATE_META[d.s.state].label}</${Badge}>
          <button class="icon-btn" title="Noter / programmer" onClick=${() => app.openHealth(d.planned ? d.s.planned : { horse_ids: [d.h.id], type: theme, status: 'fait' }, reload)}><${Icon} n="edit" size=${15} /></button>
        </div>`)}
      </div>`; })}
    ${sel.length > 0 && html`<div class="sel-bar"><b>${sel.length} cheva${sel.length > 1 ? 'ux' : 'l'} sélectionné${sel.length > 1 ? 's' : ''}</b>
      <button class="btn primary" onClick=${() => program(sel)}>📅 Programmer ensemble</button>
      <button class="btn" onClick=${() => app.openHealth({ type: theme, status: 'fait', horse_ids: sel }, () => { setSel([]); reload(); })}>✅ Noter comme fait</button>
      <button class="btn ghost" onClick=${() => setSel([])}>Annuler</button></div>`}`;
}

// ── Vue calendrier : une couleur par thème, plein = RDV prévu, pointillés = à programmer ──
function CalendarView({ dues, evts, reload, openTheme }) {
  const app = useApp(); const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [themes, setThemes] = useState(TRACKED);
  const [showDone, setShowDone] = useState(true);
  const first = month + '-01'; const gridStart = weekStart(first);
  const [y, m] = month.split('-').map(Number);
  const shift = (n) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); };
  const days = [...Array(42)].map((_, i) => addDays(gridStart, i));
  const last = days[41];
  // entrées par jour : { t, kind: 'prevu'|'due'|'fait', horses: [] }
  const map = {};
  const push = (date, t, kind, h, extra) => { if (date < gridStart || date > last || !themes.includes(t)) return; const k = date + t + kind; (map[date] ||= {}); (map[date][k] ||= { t, kind, items: [] }).items.push({ h, ...extra }); };
  for (const e of evts) { if (!HEALTH_TYPES[e.type]?.track || !app.H[e.horse_id] || app.H[e.horse_id].departure_date) continue; if (e.status === 'prevu') push(e.date, e.type, 'prevu', app.H[e.horse_id], { e }); else if (showDone) push(e.date, e.type, 'fait', app.H[e.horse_id], { e }); }
  for (const d of dues) if (!d.planned && !d.none && d.date) push(d.date < today ? today : d.date, d.t, d.date < today ? 'late' : 'due', d.h, { d });
  const order = { late: 0, prevu: 1, due: 2, fait: 3 };
  const entries = (day) => Object.values(map[day] || {}).sort((a, b) => order[a.kind] - order[b.kind] || a.t.localeCompare(b.t));
  const openDay = (day) => openModal((close) => html`<${DayModal} day=${day} entries=${entries(day)} close=${close} reload=${reload} />`);
  const Chip = ({ en }) => html`<span class=${'cchip ' + en.kind} style=${`--c:${T_COLOR(en.t)}`} title=${en.items.map((x) => x.h.name).join(', ')}>
    <span>${HEALTH_TYPES[en.t].icon}</span><b>${en.items.length}</b><span class="cc-names">${en.items.slice(0, 3).map((x) => x.h.name.split(' ')[0]).join(', ')}${en.items.length > 3 ? '…' : ''}</span></span>`;
  const agendaDays = days.filter((d) => d.slice(0, 7) === month && entries(d).length);
  return html`
    <div class="cal-top">
      <div class="week-nav"><button class="icon-btn" aria-label="Mois précédent" onClick=${() => shift(-1)}><${Icon} n="left" /></button>
        <button class="btn small ghost" onClick=${() => setMonth(today.slice(0, 7))}>Aujourd’hui</button>
        <button class="icon-btn" aria-label="Mois suivant" onClick=${() => shift(1)}><${Icon} n="right" /></button>
        <strong class="week-label">${MONTHS[m - 1]} ${y}</strong></div>
      <div class="theme-filter">${TRACKED.map((t) => html`<button class=${cls('tf', themes.includes(t) && 'on')} style=${`--c:${T_COLOR(t)}`} onClick=${() => setThemes(themes.includes(t) ? themes.filter((x) => x !== t) : [...themes, t])}>${HEALTH_TYPES[t].icon} ${HEALTH_TYPES[t].label}</button>`)}
        <label class="check small"><input type="checkbox" checked=${showDone} onChange=${(e) => setShowDone(e.target.checked)} /> afficher les soins faits</label></div>
    </div>
    <div class="cal-legend"><span><i class="cchip prevu" style="--c:#7a5c4f"></i>RDV prévu</span><span><i class="cchip due" style="--c:#7a5c4f"></i>À programmer (échéance)</span><span><i class="cchip late" style="--c:#7a5c4f"></i>En retard (affiché aujourd’hui)</span><span><i class="cchip fait" style="--c:#7a5c4f"></i>Fait</span></div>
    <div class="bigcal">
      ${['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'].map((d) => html`<div class="bc-dow">${d}</div>`)}
      ${days.map((d) => { const en = entries(d); return html`<button class=${cls('bc-day', d.slice(0, 7) !== month && 'other', d === today && 'today', d < today && 'past')} onClick=${() => openDay(d)}>
        <span class="bc-num">${Number(d.slice(8))}</span>
        <span class="bc-chips">${en.slice(0, 4).map((x) => html`<${Chip} en=${x} />`)}${en.length > 4 && html`<small class="muted">+${en.length - 4}</small>`}</span></button>`; })}
    </div>
    <div class="cal-agenda">${!agendaDays.length ? html`<${Empty} icon="🗓️" title="Rien ce mois-ci" />` : agendaDays.map((d) => html`<button class=${cls('ag-day', d === today && 'today')} onClick=${() => openDay(d)}>
      <span class="date-box" style="--c:#24415f"><small>${DOW[parseISO(d).getDay()].slice(0, 3)}</small><b>${Number(d.slice(8))}</b></span>
      <span class="ag-chips">${entries(d).map((x) => html`<${Chip} en=${x} />`)}</span></button>`)}</div>
    <p class="hint">Clique un jour pour voir les chevaux concernés et programmer le lot en un clic. Les chevaux en retard sont regroupés sur aujourd’hui.</p>`;
}

function DayModal({ day, entries, close, reload }) {
  const app = useApp(); const today = todayISO();
  const program = (t, ids) => { close(); app.openHealth({ type: t, status: 'prevu', horse_ids: ids, date: day < today ? today : day, practitioner: { marechal: 'Kevin Arzul', osteo: 'Julie Carnus' }[t] || '' }, reload); };
  const KIND = { prevu: 'RDV prévu', due: 'À programmer', late: 'En retard — à programmer', fait: 'Fait' };
  return html`<${Modal} title=${fmtDate(day, 'long')} icon="🗓️" close=${close} footer=${html`<button class="btn primary" onClick=${() => { close(); app.openHealth({ status: 'prevu', date: day < today ? today : day }, reload); }}><${Icon} n="plus" /> Programmer un RDV ce jour</button>`}>
    ${!entries.length ? html`<p class="muted">Rien de prévu ce jour-là.</p>` : entries.map((en) => html`<div class=${'day-lot ' + en.kind} style=${`--c:${T_COLOR(en.t)}`}>
      <div class="dl-h"><span>${HEALTH_TYPES[en.t].icon}</span><b>${HEALTH_TYPES[en.t].label}</b><small>${KIND[en.kind]} · ${en.items.length} cheva${en.items.length > 1 ? 'ux' : 'l'}</small>
        ${(en.kind === 'due' || en.kind === 'late') && html`<button class="btn small" onClick=${() => program(en.t, en.items.map((x) => x.h.id))}>📅 Programmer ce lot</button>`}</div>
      <div class="dl-list">${en.items.map((x) => html`<a class="hchip" href=${'#cheval-' + x.h.id} onClick=${close}>${x.h.name}${x.e?.time ? ' · ' + fmtTime(x.e.time) : ''}${x.d?.date && en.kind === 'late' ? ' (échu ' + fmtDate(x.d.date, 'dm') + ')' : ''}</a>`)}</div>
      ${en.kind === 'prevu' && en.items[0].e?.practitioner && html`<small class="muted">👤 ${en.items[0].e.practitioner}</small>`}
    </div>`)}
  </${Modal}>`;
}

// ═════════════════════ RATIONS ═════════════════════
export function Rations() {
  const app = useApp(); const horses = app.horses.filter((h) => !h.departure_date);
  return html`<section class="page">
    <${PageHead} title="Rations" sub="La fiche de la sellerie / salle d’alimentation. Chaque propriétaire met à jour la ration de son cheval depuis sa fiche.">
      <button class="btn ghost" onClick=${() => print()}><${Icon} n="printer" size=${18} /> Imprimer</button>
    </${PageHead}>
    <div class="card scroll-x"><table class="table rations">
      <thead><tr><th>Cheval</th><th>☀️ Matin</th><th>🌙 Soir</th><th>➕ Compléments</th></tr></thead>
      <tbody>${horses.map((h) => html`<tr><th><a href=${'#cheval-' + h.id}>${h.name}</a><small>${app.ownerName(h)}</small></th><td>${h.ration_morning || '—'}</td><td>${h.ration_evening || '—'}</td><td>${h.supplements || ''}</td></tr>`)}</tbody>
    </table></div></section>`;
}

// ═════════════════════ ARCHIVER UN CHEVAL ═════════════════════
export function openArchiveHorse(app, h, after) { openModal((close) => html`<${ArchiveHorse} h=${h} close=${close} after=${after} />`); }
function ArchiveHorse({ h, close, after }) {
  const app = useApp(); const f = useForm({ departure_date: todayISO(), destination: '' });
  const save = async (e) => {
    e.preventDefault();
    try {
      await db.update('horses', h.id, { departure_date: f.v.departure_date, destination: f.v.destination });
      // les DP/TP de ce cheval ne sont plus rattachés
      for (const r of app.riders.filter((r) => r.horse_id === h.id)) await db.remove('horse_riders', r.id);
      await app.reloadBase(); close(); after?.(); toast(`${h.name} est archivé·e 🗄️`);
    } catch (er) { fail(er); }
  };
  return html`<${Modal} title=${'Archiver ' + h.name} icon="🗄️" close=${close} footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="arh">Archiver</button>`}>
    <form id="arh" class="form" onSubmit=${save}>
      <p>${h.name} disparaît des listes, du planning et du tableau sanitaire, mais <b>tout son historique est conservé</b> : carnet de santé, documents, et sa sortie est inscrite au <b>registre d’élevage</b>.</p>
      <div class="row2"><${Field} label="Date de sortie"><input type="date" required ...${f.bind('departure_date')} /></${Field}>
        <${Field} label="Destination" hint="Obligatoire pour le registre"><input required placeholder="Nouvelle écurie, propriétaire, retraite…" ...${f.bind('destination')} /></${Field}></div>
      <p class="hint">💡 Pense à télécharger le carnet en PDF pour le propriétaire (bouton « Carnet en PDF »).</p>
    </form></${Modal}>`;
}
