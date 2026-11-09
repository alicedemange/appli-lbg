import { html, useState } from '../lib.js';
import { db, auth, DEMO, resetDemo, loginSlug } from '../db.js';
import { useApp, Icon, Avatar, HorseAvatar, Modal, openModal, confirmBox, toast, fail, useForm, Field, Seg, ChipPick, Badge, useData, PageHead, Empty, Loading, Tabs } from '../ui.js';
import { todayISO, fmtDate, fmtTime, HEALTH_TYPES, EVENT_TYPES, ROLES, SEXES, cls, genCode, csv, downloadText } from '../util.js';
import { PRES_KINDS } from './planning.js';

// ═════════════════════ REGISTRE D'ÉLEVAGE ═════════════════════
export function Registre() {
  const app = useApp();
  const [tab, setTab] = useState('equides');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [d, reload] = useData(async () => ({ settings: (await db.select('settings', { eq: { id: 'registre' } }))[0]?.data || {}, health: await db.select('health_events', { order: 'date' }) }), []);
  if (!d) return html`<section class="page"><${Loading} /></section>`;
  const horses = [...app.horses].sort((a, b) => (a.arrival_date || '').localeCompare(b.arrival_date || ''));
  const soins = d.health.filter((e) => e.status !== 'prevu' && e.date.startsWith(year));
  const years = [...new Set(d.health.map((e) => e.date.slice(0, 4)))].sort().reverse();
  const S = d.settings;

  const exportCsv = () => {
    if (tab === 'equides') downloadText(`registre-equides-${todayISO()}.csv`, csv([['Nom', 'Sexe', 'Né le', 'Race', 'Robe', 'SIRE', 'UELN', 'Transpondeur', 'Propriétaire', 'Entrée le', 'Provenance', 'Sortie le', 'Destination'],
      ...horses.map((h) => [h.name, SEXES[h.sex], fmtDate(h.birth_date), h.breed, h.robe, h.sire, h.ueln, h.transponder, app.ownerName(h), fmtDate(h.arrival_date), h.origin, h.departure_date ? fmtDate(h.departure_date) : '', h.destination])]));
    else downloadText(`registre-soins-${year}.csv`, csv([['Date', 'Cheval', 'UELN', 'Type', 'Intervenant', 'Produit / traitement', 'N° lot', 'Observations'],
      ...soins.map((e) => [fmtDate(e.date), app.H[e.horse_id]?.name, app.H[e.horse_id]?.ueln, HEALTH_TYPES[e.type]?.label, e.practitioner, e.product, e.lot, e.notes])]));
  };
  return html`<section class="page registre">
    <${PageHead} title="Registre d’élevage" sub="Tenu à jour automatiquement à partir des fiches chevaux et des carnets de santé. À conserver 5 ans.">
      <button class="btn ghost" onClick=${exportCsv}><${Icon} n="download" size=${18} /> Export Excel (CSV)</button>
      <button class="btn ghost" onClick=${() => print()}><${Icon} n="printer" size=${18} /> Imprimer</button>
    </${PageHead}>
    <div class="card reg-head">
      <div><h3>🏡 Lieu de détention</h3>
        <dl class="kv small">${[['Détenteur', S.holder_name], ['N° détenteur (SIRE)', S.holder_number], ['Adresse', S.address], ['Activité', S.activity], ['Vétérinaire sanitaire', [S.vet_name, S.vet_phone].filter(Boolean).join(' — ')], ['Registre ouvert le', fmtDate(S.opened_on)]].map(([k, v]) => html`<dt>${k}</dt><dd>${v || html`<span class="warn">à compléter</span>`}</dd>`)}</dl></div>
      <button class="btn small ghost noprint" onClick=${() => openSettings(S, reload)}><${Icon} n="edit" size=${14} /> Modifier</button>
    </div>
    <div class="toolbar noprint"><${Tabs} value=${tab} onChange=${setTab} tabs=${[['equides', '🐴 Équidés & mouvements'], ['soins', '🩺 Soins & interventions']]} />
      ${tab === 'soins' && html`<select value=${year} onChange=${(e) => setYear(e.target.value)}>${(years.length ? years : [year]).map((y) => html`<option>${y}</option>`)}</select>`}</div>
    ${tab === 'equides' ? html`<div class="card scroll-x"><table class="table">
      <thead><tr><th>Équidé</th><th>Identification</th><th>Propriétaire</th><th>Entrée</th><th>Sortie</th></tr></thead>
      <tbody>${horses.map((h) => html`<tr class=${h.departure_date ? 'out' : ''}>
        <td><a href=${'#cheval-' + h.id}><b>${h.name}</b></a><br /><small>${[SEXES[h.sex], h.breed, h.robe, h.birth_date && 'né·e ' + fmtDate(h.birth_date)].filter(Boolean).join(' · ')}</small></td>
        <td><small>${h.ueln ? 'UELN ' + h.ueln : ''}${h.sire ? html`<br />SIRE ${h.sire}` : ''}${h.transponder ? html`<br />Puce ${h.transponder}` : ''}${!h.ueln && !h.sire && !h.transponder ? html`<span class="warn">à compléter</span>` : ''}</small></td>
        <td>${app.ownerName(h)}</td>
        <td>${fmtDate(h.arrival_date)}<br /><small>${h.origin || ''}</small></td>
        <td>${h.departure_date ? html`${fmtDate(h.departure_date)}<br /><small>${h.destination}</small>` : html`<${Badge} color="#3f8a5a">présent</${Badge}>`}</td></tr>`)}</tbody></table></div>
      <p class="hint">💡 Quand un cheval quitte l’écurie, renseigne sa date de sortie et sa destination dans sa fiche : il reste dans le registre.</p>`
    : html`<div class="card scroll-x">${!soins.length ? html`<${Empty} icon="📒" title=${'Aucun soin en ' + year} />` : html`<table class="table">
      <thead><tr><th>Date</th><th>Équidé</th><th>Intervention</th><th>Intervenant</th><th>Produit / lot</th><th>Observations</th></tr></thead>
      <tbody>${soins.map((e) => html`<tr><td>${fmtDate(e.date)}</td><td>${app.H[e.horse_id]?.name}</td><td>${HEALTH_TYPES[e.type]?.icon} ${HEALTH_TYPES[e.type]?.label}</td><td>${e.practitioner}</td><td>${e.product}${e.lot ? html`<br /><small>lot ${e.lot}</small>` : ''}</td><td><small>${e.notes}</small></td></tr>`)}</tbody></table>`}</div>
      <p class="hint">Les ordonnances vétérinaires papier restent à classer avec le registre (5 ans).</p>`}
  </section>`;
}
function openSettings(S, reload) { openModal((close) => html`<${SettingsForm} S=${S} close=${close} reload=${reload} />`); }
function SettingsForm({ S, close, reload }) {
  const f = useForm({ holder_name: '', holder_number: '', address: '', activity: '', vet_name: '', vet_phone: '', opened_on: '', ...S });
  const save = async (e) => { e.preventDefault(); try { await db.upsert('settings', { id: 'registre', data: f.v }); close(); reload(); toast('Enregistré'); } catch (er) { fail(er); } };
  return html`<${Modal} title="Lieu de détention" close=${close} footer=${html`<button class="btn primary" form="sf">Enregistrer</button>`}>
    <form id="sf" class="form" onSubmit=${save}>
      <${Field} label="Détenteur (nom)"><input ...${f.bind('holder_name')} /></${Field}>
      <div class="row2"><${Field} label="N° de détenteur SIRE"><input ...${f.bind('holder_number')} /></${Field}><${Field} label="Registre ouvert le"><input type="date" ...${f.bind('opened_on')} /></${Field}></div>
      <${Field} label="Adresse du lieu de détention"><input ...${f.bind('address')} /></${Field}>
      <${Field} label="Type d’activité"><input ...${f.bind('activity')} /></${Field}>
      <div class="row2"><${Field} label="Vétérinaire sanitaire"><input ...${f.bind('vet_name')} /></${Field}><${Field} label="Son téléphone"><input ...${f.bind('vet_phone')} /></${Field}></div>
    </form></${Modal}>`;
}

// ═════════════════════ MEMBRES & ACCÈS ═════════════════════
export function Membres() {
  const app = useApp();
  const [inv, reload] = useData(() => db.select('invitations', { order: '-created_at' }), []);
  const [tab, setTab] = useState('membres');
  const pending = (inv || []).filter((i) => !i.used_by);
  const waiting = app.profiles.filter((p) => p.role === 'nouveau');
  const archived = app.profiles.filter((p) => p.role === 'archive');
  const setRole = async (p, role) => { if (p.id === app.me.id) return toast('Tu ne peux pas changer ton propre rôle', 'err'); await db.update('profiles', p.id, { role, claim_failures: 0 }).catch(fail); app.reloadBase(); };
  const pdf = (p) => import('../pdf.js').then((m) => m.dossierPdf(app, p)).catch(fail);
  const resetPin = async (p) => {
    if (!(await confirmBox(`Créer un nouveau code PIN pour ${p.full_name} ? L’ancien ne marchera plus.`, { ok: 'Nouveau code PIN' }))) return;
    try { const code = await auth.adminResetPin(p.id); showMessage(pinMessage(p.full_name, p.login_label || p.full_name.split(' ')[0], code), 'Nouveau code PIN de ' + p.full_name); } catch (e) { fail(e); }
  };
  const year = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  const horsesOf = (p) => [...app.horses.filter((h) => h.owner_id === p.id && !h.departure_date).map((h) => h.name), ...app.riders.filter((r) => r.profile_id === p.id).map((r) => r.kind + ' ' + app.H[r.horse_id]?.name)].join(', ');
  return html`<section class="page">
    <${PageHead} title="Membres & accès" sub="Chacun entre dans l’appli avec son prénom et son code PIN. Code oublié : « 🔑 Nouveau PIN ».">
      <button class="btn primary" onClick=${() => openInvite(app, reload)}><${Icon} n="key" size=${18} /> Créer un code PIN</button>
    </${PageHead}>
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['membres', `👥 Membres (${app.members.length})`], ['codes', `🔑 Codes PIN (${pending.length + waiting.length})`], ['anciens', `🗄️ Anciens (${archived.length})`], ['licences', `🎫 Licences ${year}`]]} />
    ${tab === 'codes' && html`
      ${waiting.length > 0 && html`<div class="card"><h3>⏳ Comptes créés sans code valide</h3><p class="muted small">Ces personnes ont créé un compte mais n’ont pas (encore) saisi le bon code PIN, ou se sont trompées 5 fois. Si tu les reconnais, active-les ici.</p>
        <ul class="plist">${waiting.map((p) => html`<li><span class="pname"><${Avatar} p=${p} size=${28} /><span><b>${p.full_name}</b><small>${[p.email, p.claim_failures && `${p.claim_failures} essai(s) raté(s)`].filter(Boolean).map((x) => ' · ' + x).join('')}</small></span></span><span class="grow"></span>
          <select class="mini" onChange=${(e) => e.target.value && setRole(p, e.target.value)}><option value="">Activer comme…</option><option value="proprietaire">Propriétaire</option><option value="dp">DP / TP</option><option value="admin">Admin</option></select></li>`)}</ul></div>`}
      ${!pending.length ? html`<${Empty} icon="🔑" title="Aucun code en attente" text="Crée un code PIN pour inviter quelqu’un : tu choisis son espace et ses chevaux, il n’a plus qu’à créer son compte." />`
      : html`<div class="codes">${pending.map((i) => html`<div class="code-card"><div class="code">${i.code}</div><div><b>${i.full_name}</b> <small class="muted">· prénom de connexion : ${i.login_label || i.login}</small><br /><small>${ROLES[i.role]?.label}${i.horse_ids?.length ? ' · ' + i.horse_ids.map((h) => app.H[h]?.name).join(', ') : ''}</small><br /><small class="muted">créé le ${fmtDate(i.created_at.slice(0, 10))} · pas encore utilisé · valable 30 jours</small></div>
          <div class="code-act"><button class="btn small" onClick=${() => copyInvite(i)}><${Icon} n="copy" size=${14} /> Message</button>
          <button class="icon-btn" aria-label="Supprimer" onClick=${async () => { if (await confirmBox('Supprimer ce code ?', { ok: 'Supprimer', danger: true })) { await db.remove('invitations', i.id).catch(fail); reload(); } }}><${Icon} n="trash" size=${16} /></button></div></div>`)}</div>`}
      <p class="hint">🔒 Un code PIN non utilisé expire après 30 jours. Après la 1re connexion, il devient le code personnel de la personne (elle peut le changer dans « Mon profil »).</p>`}
    ${tab === 'membres' && html`<div class="card scroll-x"><table class="table">
      <thead><tr><th>Membre</th><th>Prénom de connexion</th><th>Rôle</th><th>Chevaux</th><th>Téléphone</th><th></th></tr></thead>
      <tbody>${app.members.map((p) => html`<tr><td><span class="pname"><${Avatar} p=${p} size=${28} /><b>${p.full_name || '?'}</b></span></td>
        <td><small>${p.login_label || p.login || '—'}</small></td>
        <td><select value=${p.role} disabled=${p.id === app.me.id} onChange=${(e) => setRole(p, e.target.value)}>${['admin', 'proprietaire', 'dp'].map((k) => html`<option value=${k}>${ROLES[k].label}</option>`)}</select></td>
        <td><small>${horsesOf(p)}</small></td><td><small>${p.phone || '—'}</small></td>
        <td><div class="member-actions">${p.id !== app.me.id && html`<button class="btn small ghost" title="Code PIN oublié" onClick=${() => resetPin(p)}>🔑 Nouveau PIN</button>`}<button class="btn small ghost" title="Dossier PDF" onClick=${() => pdf(p)}>📄 PDF</button>
          ${p.id !== app.me.id && html`<button class="btn small ghost" onClick=${() => openArchiveMember(app, p)}>🗄️ Archiver</button>`}</div></td></tr>`)}</tbody></table></div>
      <p class="hint">Quand quelqu’un quitte l’écurie : « Archiver ». Il n’a plus accès à l’appli, mais tout son historique est conservé (et réactivable).</p>`}
    ${tab === 'anciens' && html`${!archived.length ? html`<${Empty} icon="🗄️" title="Aucun ancien membre" />` : html`<div class="card"><ul class="plist">${archived.map((p) => html`<li>
        <span class="pname"><${Avatar} p=${p} size=${28} /><span><b>${p.full_name}</b><small> · archivé${p.archived_at ? ' le ' + fmtDate(p.archived_at.slice(0, 10)) : ''}</small></span></span><span class="grow"></span>
        <button class="btn small ghost" onClick=${() => pdf(p)}>📄 Dossier PDF</button>
        <select class="mini" onChange=${(e) => e.target.value && setRole(p, e.target.value)}><option value="">Réactiver comme…</option><option value="proprietaire">Propriétaire</option><option value="dp">DP / TP</option></select></li>`)}</ul></div>`}`}
    ${tab === 'licences' && html`<div class="card scroll-x"><table class="table"><thead><tr><th>Cavalier</th><th>N° licence FFE</th><th>Année</th></tr></thead>
      <tbody>${app.members.map((p) => html`<tr><td>${p.full_name}</td><td>${p.licence_ffe || '—'}</td>
        <td>${Number(p.licence_year) >= year ? html`<${Badge} color="#3f8a5a">${p.licence_year} ✓</${Badge}>` : html`<${Badge} color="#c2453d">${p.licence_year || 'aucune'}</${Badge}>`}</td></tr>`)}</tbody></table></div>
      <p class="hint">Chacun renseigne sa licence dans « Mon profil ». Indispensable pour les concours.</p>`}
  </section>`;
}

function openArchiveMember(app, p) { openModal((close) => html`<${ArchiveMember} p=${p} close=${close} />`); }
function ArchiveMember({ p, close }) {
  const app = useApp();
  const horses = app.horses.filter((h) => h.owner_id === p.id && !h.departure_date);
  const [withHorses, setWithHorses] = useState(horses.length > 0);
  const [dest, setDest] = useState('Départ avec son propriétaire');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      if (withHorses) for (const h of horses) await db.update('horses', h.id, { departure_date: todayISO(), destination: dest });
      for (const r of app.riders.filter((r) => r.profile_id === p.id)) await db.remove('horse_riders', r.id);
      const parts = await db.select('event_participants', { eq: { profile_id: p.id } });
      const future = parts.length ? await db.select('events', { in: { id: parts.map((x) => x.event_id) }, gte: { date: todayISO() } }) : [];
      for (const x of parts.filter((x) => future.some((e) => e.id === x.event_id))) await db.remove('event_participants', x.id);
      await db.update('profiles', p.id, { role: 'archive', archived_at: new Date().toISOString() });
      await app.reloadBase(); close(); toast(`${p.full_name} est archivé·e 🗄️`);
    } catch (e) { fail(e); }
    setBusy(false);
  };
  return html`<${Modal} title=${'Archiver ' + p.full_name} icon="🗄️" close=${close} footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" disabled=${busy} onClick=${go}>Archiver</button>`}>
    <div class="form">
      <p><b>${p.full_name}</b> n’aura plus accès à l’appli et disparaîtra de l’annuaire et du planning. <b>Rien n’est supprimé</b> : son historique reste dans l’Historique, le registre d’élevage et l’onglet « Anciens », d’où tu peux la réactiver.</p>
      <button class="btn big" onClick=${() => import('../pdf.js').then((m) => m.dossierPdf(app, p)).catch(fail)}>📄 Télécharger d’abord son dossier PDF</button>
      <small class="hint" style="margin:0">À lui envoyer s’il le souhaite : coordonnées, carnet de santé de ses chevaux, contrats, participations.</small>
      ${horses.length > 0 && html`<label class="check"><input type="checkbox" checked=${withHorses} onChange=${(e) => setWithHorses(e.target.checked)} /> Archiver aussi ${horses.length > 1 ? 'ses chevaux' : 'son cheval'} : <b>${horses.map((h) => h.name).join(', ')}</b> (sortie aujourd’hui)</label>
        ${withHorses && html`<${Field} label="Destination (registre d’élevage)"><input value=${dest} onInput=${(e) => setDest(e.target.value)} /></${Field}>`}`}
      <p class="hint" style="margin:0">Ses inscriptions à venir seront retirées${app.riders.some((r) => r.profile_id === p.id) ? ' et sa demi-pension / tiers de pension arrêtée' : ''}.</p>
    </div></${Modal}>`;
}
export function pinMessage(name, login, code) {
  return `Bonjour ${name.split(' ')[0]} ! 🐴\nVoici ton accès à l’appli des Écuries la Barthe Grande :\n👉 ${location.origin + location.pathname}\nPrénom : ${login}\nCode PIN : ${code}\nTape simplement ton prénom et ton code PIN pour entrer (garde-le précieusement, il te servira à chaque connexion).\nÀ très vite à l’écurie !`;
}
export function showMessage(msg, title = 'Message à envoyer') {
  openModal((close) => html`<${Modal} title=${title} close=${close} footer=${html`<button class="btn primary" onClick=${async () => { try { await navigator.clipboard.writeText(msg); toast('Copié ! Colle-le dans WhatsApp ou par SMS'); close(); } catch (e) { toast('Sélectionne le texte et copie-le à la main', 'err'); } }}><${Icon} n="copy" size=${16} /> Copier</button>`}>
    <textarea class="msg" rows="8" readonly value=${msg} onFocus=${(e) => e.target.select()}></textarea></${Modal}>`);
}
function copyInvite(i) { showMessage(pinMessage(i.full_name, i.login_label || i.full_name.split(' ')[0], i.code)); }
function openInvite(app, reload) { openModal((close) => html`<${InviteForm} close=${close} reload=${reload} />`); }
function InviteForm({ close, reload }) {
  const app = useApp();
  const f = useForm({ full_name: '', login_label: '', role: 'proprietaire', horse_ids: [], rider_kind: 'DP' });
  const [touched, setTouched] = useState(false);
  const label = touched ? f.v.login_label : f.v.full_name.trim().split(/\s+/)[0] || '';
  const slug = loginSlug(label);
  const taken = (sl) => app.profiles.some((p) => p.login === sl) || (invs || []).some((i) => i.login === sl && !i.used_by);
  const [invs] = useData(() => db.select('invitations'), []);
  const save = async (e) => {
    e.preventDefault();
    if (!slug) return toast('Indique un prénom de connexion', 'err');
    if (taken(slug)) return toast(`« ${label} » est déjà pris : ajoute l’initiale du nom (ex. ${label} D)`, 'err');
    try { const [i] = await db.insert('invitations', { code: genCode(), full_name: f.v.full_name.trim(), login: slug, login_label: label, role: f.v.role, horse_ids: f.v.horse_ids, rider_kind: f.v.rider_kind }); close(); reload(); copyInvite(i); } catch (er) { fail(er); }
  };
  return html`<${Modal} title="Nouveau code PIN d’accès" icon="🔑" close=${close} footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="invf">Générer le code PIN</button>`}>
    <form id="invf" class="form" onSubmit=${save}>
      <${Field} label="Prénom / nom"><input required placeholder="Ex. Lyna Nicolaescu" ...${f.bind('full_name')} /></${Field}>
      <${Field} label="Prénom de connexion" hint=${slug && taken(slug) ? '⚠️ Déjà utilisé : ajoute l’initiale du nom (ex. « Alice D »).' : 'C’est ce qu’il tapera avec son code PIN pour entrer (accents et majuscules sans importance).'}>
        <input required value=${label} onInput=${(e) => { setTouched(true); f.set('login_label', e.target.value); }} /></${Field}>
      <${Field} label="Espace"><${Seg} value=${f.v.role} onChange=${(k) => f.set('role', k)} options=${[['proprietaire', '🐴 Propriétaire'], ['dp', '🏇 DP / TP'], ['admin', '🔑 Admin']]} /></${Field}>
      ${f.v.role === 'dp' && html`<${Field} label="Formule"><${Seg} small value=${f.v.rider_kind} onChange=${(k) => f.set('rider_kind', k)} options=${[['DP', 'Demi-pension'], ['TP', 'Tiers de pension']]} /></${Field}>`}
      ${f.v.role !== 'admin' && html`<${Field} label=${f.v.role === 'dp' ? 'Cheval monté' : 'Ses chevaux déjà dans l’appli (optionnel)'} hint=${f.v.role === 'proprietaire' ? 'Il pourra aussi créer lui-même la fiche de son cheval.' : ''}>
        <${ChipPick} value=${f.v.horse_ids} onChange=${(v) => f.set('horse_ids', v)} options=${app.horses.filter((h) => !h.departure_date).map((h) => [h.id, h.name])} /></${Field}>`}
    </form></${Modal}>`;
}

// ═════════════════════ MON PROFIL ═════════════════════
export function Profil() {
  const app = useApp(); const me = app.me;
  const f = useForm({ full_name: me.full_name || '', phone: me.phone || '', licence_ffe: me.licence_ffe || '', licence_year: me.licence_year || '', color: me.color || '' });
  const [pw, setPw] = useState('');
  const save = async (e) => { e.preventDefault(); try { await db.update('profiles', me.id, { ...f.v, licence_year: f.v.licence_year ? Number(f.v.licence_year) : null, color: f.v.color || null }); await app.reloadBase(); toast('Profil enregistré'); } catch (er) { fail(er); } };
  const colors = ['#2f5d8a', '#7a5c4f', '#4f8a5b', '#8a5aa6', '#c0812f', '#2f8a8a', '#b4505a', '#5b6bb8', '#7a8a2f', '#6b4f3a'];
  return html`<section class="page narrow">
    <${PageHead} title="Mon profil" />
    <form class="card form" onSubmit=${save}>
      <div class="profile-top"><${Avatar} p=${{ ...me, ...f.v, color: f.v.color || null }} size=${64} /><div><b>${f.v.full_name}</b><br /><${Badge} color=${ROLES[me.role]?.color}>${ROLES[me.role]?.label}</${Badge}></div></div>
      <div class="row2"><${Field} label="Prénom / nom"><input required ...${f.bind('full_name')} /></${Field}><${Field} label="Téléphone (visible dans l’annuaire)"><input type="tel" ...${f.bind('phone')} /></${Field}></div>
      <div class="row2"><${Field} label="N° de licence FFE"><input ...${f.bind('licence_ffe')} /></${Field}><${Field} label="Licence valable pour l’année"><input type="number" ...${f.bind('licence_year')} /></${Field}></div>
      <${Field} label="Ma couleur"><div class="colors">${colors.map((c) => html`<button type="button" class=${cls('color', f.v.color === c && 'on')} style=${`background:${c}`} onClick=${() => f.set('color', c)} aria-label=${c}></button>`)}</div></${Field}>
      <div class="right"><button class="btn primary">Enregistrer</button></div>
    </form>
    <form class="card form" onSubmit=${async (e) => { e.preventDefault(); try { const c = await auth.changePin(pw); setPw(''); toast('Nouveau code PIN : ' + c); } catch (er) { fail(er); } }}>
      <h3>🔑 Mon accès</h3><p class="small muted" style="margin:0">Prénom de connexion : <b>${me.login_label || me.login || me.full_name?.split(' ')[0]}</b></p>
      <div class="inline-form"><input minlength="6" maxlength="12" autocapitalize="characters" placeholder="Nouveau code PIN (6 caractères min.)" value=${pw} onInput=${(e) => setPw(e.target.value)} /><button class="btn" disabled=${pw.replace(/\s/g, '').length < 6}>Changer mon code PIN</button></div>
      <small class="hint" style="margin:0">Lettres et chiffres, au moins 6. Note-le bien : c’est lui qui te permet d’entrer.</small></form>
    ${(me.role !== 'admin' || app.myHorseIds.length > 0) && html`<div class="card"><h3>📄 Mes données</h3><p class="muted small">Télécharge à tout moment ton dossier complet : coordonnées, fiche et carnet de santé de ${app.myHorseIds.length > 1 ? 'tes chevaux' : 'ton cheval'}, contrats, participations aux événements.</p>
      <button class="btn" onClick=${() => import('../pdf.js').then((m) => m.dossierPdf(app, me)).catch(fail)}><${Icon} n="download" size=${18} /> Télécharger mon dossier (PDF)</button></div>`}
    <div class="card"><button class="btn ghost" onClick=${app.logout}><${Icon} n="logout" size=${18} /> Se déconnecter</button>
      ${DEMO && html` <button class="btn ghost danger" onClick=${async () => { if (await confirmBox('Remettre la démo à zéro ? Tout ce que tu as ajouté sera effacé.', { ok: 'Réinitialiser', danger: true })) resetDemo(); }}>Réinitialiser la démo</button>`}</div>
  </section>`;
}

// ═════════════════════ HISTORIQUE & EXPORTS (admin) ═════════════════════
const PERIODS = () => {
  const t = todayISO(); const y = t.slice(0, 4); const m = t.slice(0, 7);
  const pm = new Date(Number(y), Number(t.slice(5, 7)) - 2, 1); const pmISO = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}`;
  const lastDay = new Date(pm.getFullYear(), pm.getMonth() + 1, 0).getDate();
  return { mois: [m + '-01', t], precedent: [pmISO + '-01', `${pmISO}-${lastDay}`], annee: [y + '-01-01', t], tout: ['2000-01-01', t] };
};
export function Historique() {
  const app = useApp(); const { P, H } = app;
  const [range, setRange] = useState(PERIODS().mois);
  const [quick, setQuick] = useState('mois');
  const [show, setShow] = useState(['events', 'presences', 'health']);
  const [from, to] = range;
  const [d] = useData(async () => {
    const [events, presences, health] = await Promise.all([
      db.select('events', { gte: { date: from }, lte: { date: to }, order: ['date', 'start_time'] }),
      db.select('presences', { gte: { date: from }, lte: { date: to }, order: ['date', 'time'] }),
      db.select('health_events', { gte: { date: from }, lte: { date: to }, order: 'date' }),
    ]);
    const parts = await db.select('event_participants', { in: { event_id: events.map((e) => e.id) } });
    return { events, presences, health: health.filter((h) => h.status !== 'prevu'), parts };
  }, [from, to]);
  const pick = (k) => { setQuick(k); setRange(PERIODS()[k]); };
  const who = (id) => P[id]?.full_name || '';
  const hn = (id) => (id ? H[id]?.name || '' : '');

  const lines = !d ? [] : [
    ...(show.includes('events') ? d.events.map((e) => ({ date: e.date, time: e.start_time, kind: 'ev', e, parts: d.parts.filter((p) => p.event_id === e.id) })) : []),
    ...(show.includes('presences') ? d.presences.map((p) => ({ date: p.date, time: p.time, kind: 'pr', p })) : []),
    ...(show.includes('health') ? d.health.map((h) => ({ date: h.date, time: h.time, kind: 'hs', h })) : []),
  ].sort((a, b) => b.date.localeCompare(a.date) || (a.time || '').localeCompare(b.time || ''));
  const days = {}; for (const l of lines) (days[l.date] ||= []).push(l);
  const tag = `${from}_${to}`;

  const exportJournal = () => downloadText(`journal-ecurie-${tag}.csv`, csv([['Date', 'Heure', 'Catégorie', 'Détail', 'Personne', 'Cheval', 'Infos'],
    ...lines.slice().reverse().flatMap((l) => l.kind === 'ev'
      ? (l.parts.length ? l.parts : [{}]).map((p) => [fmtDate(l.date), fmtTime(l.time), EVENT_TYPES[l.e.type]?.label, l.e.title, who(p.profile_id), hn(p.horse_id),
          [p.status === 'absent' && 'absent·e', p.bring, p.group_label, p.class_name, p.bib && 'dossard ' + p.bib, p.result].filter(Boolean).join(' · ')])
      : l.kind === 'pr' ? [[fmtDate(l.date), fmtTime(l.time), 'Présence', PRES_KINDS[l.p.kind]?.label, who(l.p.profile_id), hn(l.p.horse_id), l.p.note]]
      : [[fmtDate(l.date), fmtTime(l.time), 'Soin', HEALTH_TYPES[l.h.type]?.label, l.h.practitioner, hn(l.h.horse_id), [l.h.product, l.h.lot && 'lot ' + l.h.lot, l.h.notes].filter(Boolean).join(' · ')]])]));
  const exportEvents = () => downloadText(`planning-${tag}.csv`, csv([['Date', 'Début', 'Fin', 'Type', 'Titre', 'Lieu', 'Cavalier', 'Cheval', 'Statut', 'Apporte', 'Groupe', 'Heure groupe', 'Épreuve', 'Dossard', 'Heure passage', 'Résultat'],
    ...d.events.flatMap((e) => { const ps = d.parts.filter((p) => p.event_id === e.id); return (ps.length ? ps : [{}]).map((p) => [fmtDate(e.date), fmtTime(e.start_time), fmtTime(e.end_time), EVENT_TYPES[e.type]?.label, e.title, e.location,
      who(p.profile_id), hn(p.horse_id), p.status || '', p.bring, p.group_label, fmtTime(p.slot_time), p.class_name, p.bib, fmtTime(p.class_time), p.result]); })]));
  const exportPres = () => downloadText(`presences-${tag}.csv`, csv([['Date', 'Heure', 'Personne', 'Type', 'Cheval', 'Note'],
    ...d.presences.map((p) => [fmtDate(p.date), fmtTime(p.time), who(p.profile_id), PRES_KINDS[p.kind]?.label, hn(p.horse_id), p.note])]));
  const exportSoins = () => downloadText(`soins-${tag}.csv`, csv([['Date', 'Heure', 'Cheval', 'Type', 'Intervenant', 'Produit', 'Lot', 'Observations'],
    ...d.health.map((h) => [fmtDate(h.date), fmtTime(h.time), hn(h.horse_id), HEALTH_TYPES[h.type]?.label, h.practitioner, h.product, h.lot, h.notes])]));

  // Statistiques de la période
  const stats = d ? (() => {
    const inn = d.parts.filter((p) => p.status !== 'absent');
    const venues = {}; for (const p of d.presences.filter((x) => x.kind !== 'absent')) venues[p.profile_id] = (venues[p.profile_id] || 0) + 1;
    for (const p of inn) venues[p.profile_id] = (venues[p.profile_id] || 0) + 1;
    const top = Object.entries(venues).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { ev: d.events.length, cours: d.events.filter((e) => e.type === 'cours').length, part: inn.length, pres: d.presences.filter((p) => p.kind !== 'absent').length, abs: d.presences.filter((p) => p.kind === 'absent').length + d.parts.filter((p) => p.status === 'absent').length, soins: d.health.length, top };
  })() : null;

  return html`<section class="page">
    <${PageHead} title="Historique & exports" sub="Tout ce qui s’est passé à l’écurie : événements et qui y était, venues, absences, soins. Exportable en Excel (CSV).">
      <button class="btn primary" disabled=${!d} onClick=${exportJournal}><${Icon} n="download" size=${18} /> Journal complet</button>
      <button class="btn ghost" onClick=${() => print()}><${Icon} n="printer" size=${18} /> Imprimer</button>
    </${PageHead}>
    <div class="card hist-filters noprint">
      <${Seg} value=${quick} onChange=${pick} options=${[['mois', 'Ce mois-ci'], ['precedent', 'Mois dernier'], ['annee', 'Cette année'], ['tout', 'Tout'], ['perso', 'Dates…']]} />
      ${quick === 'perso' && html`<div class="inline-form" style="margin:0"><label>du <input type="date" value=${from} onChange=${(e) => setRange([e.target.value, to])} /></label><label>au <input type="date" value=${to} onChange=${(e) => setRange([from, e.target.value])} /></label></div>`}
      <${ChipPick} value=${show} onChange=${setShow} options=${[['events', '📅 Événements'], ['presences', '🏇 Présences'], ['health', '🩺 Soins']]} />
    </div>
    <p class="muted print-only">Période du ${fmtDate(from)} au ${fmtDate(to)}</p>
    ${!d ? html`<${Loading} />` : html`
    <div class="kpis hist-kpis">
      ${[['📅', stats.ev, `événement${stats.ev > 1 ? 's' : ''} (dont ${stats.cours} cours)`, '#3b6ea8'], ['🙋', stats.part, 'participations', '#7b5ea7'], ['🏇', stats.pres, 'venues signalées', '#3f8a5a'], ['🚫', stats.abs, 'absences', '#c2453d'], ['🩺', stats.soins, 'soins notés', '#7a5c4f']]
        .map(([ic, n, l, c]) => html`<div class="kpi" style=${`--c:${c}`}><b>${n}</b><span>${ic} ${l}</span></div>`)}
    </div>
    <div class="hist-cols">
      <div class="card"><h3>📥 Exports Excel</h3>
        <div class="exports">
          <button class="exp" onClick=${exportEvents}><span>📅</span><b>Planning</b><small>1 ligne par cavalier et par événement : cours, stages (groupes), concours (épreuve, dossard, résultat), animations (qui apportait quoi)</small></button>
          <button class="exp" onClick=${exportPres}><span>🏇</span><b>Présences & absences</b><small>Qui est venu quand, avec quel cheval</small></button>
          <button class="exp" onClick=${exportSoins}><span>🩺</span><b>Soins</b><small>Vaccins, vermifuges, maréchal, dentiste, ostéo, véto…</small></button>
          <button class="exp" onClick=${exportJournal}><span>📒</span><b>Journal complet</b><small>Tout dans un seul fichier, trié par date</small></button>
        </div>
        ${stats.top.length > 0 && html`<h3 style="margin-top:18px">🏅 Les plus présents sur la période</h3><ul class="plist">${stats.top.map(([id, n]) => html`<li><span class="pname"><${Avatar} p=${P[id]} size=${26} /><b>${who(id)}</b></span><span class="grow"></span><${Badge} color="#3f8a5a">${n} venue${n > 1 ? 's' : ''}</${Badge}></li>`)}</ul>`}
      </div>
      <div class="card journal"><h3>📒 Journal</h3>
        ${!lines.length ? html`<${Empty} icon="📒" title="Rien sur cette période" />` : Object.keys(days).map((day) => html`<div class="j-day"><div class="j-date">${fmtDate(day, 'long')}</div>
          ${days[day].map((l) => l.kind === 'ev' ? html`<div class="j-row" style=${`--c:${EVENT_TYPES[l.e.type]?.color}`}><span class="j-ic">${EVENT_TYPES[l.e.type]?.icon}</span><div><b>${fmtTime(l.time)} ${l.e.title}</b>
              <small>${l.parts.filter((p) => p.status !== 'absent').map((p) => who(p.profile_id) + (p.horse_id ? ` (${hn(p.horse_id)})` : '') + (p.bib ? ` n°${p.bib}` : '') + (p.result ? ` 🏅${p.result}` : '')).join(', ') || 'aucun inscrit'}
              ${l.parts.some((p) => p.status === 'absent') ? ` — absent·e·s : ${l.parts.filter((p) => p.status === 'absent').map((p) => who(p.profile_id)).join(', ')}` : ''}</small></div></div>`
            : l.kind === 'pr' ? html`<div class=${'j-row ' + (l.p.kind === 'absent' ? 'abs' : '')}><span class="j-ic">${PRES_KINDS[l.p.kind]?.icon}</span><div><b>${who(l.p.profile_id)}</b> <small>${l.p.kind === 'absent' ? 'absent·e' : (fmtTime(l.time) || '') + (l.p.horse_id ? ' · ' + hn(l.p.horse_id) : '')}${l.p.note ? ' · ' + l.p.note : ''}</small></div></div>`
            : html`<div class="j-row"><span class="j-ic">${HEALTH_TYPES[l.h.type]?.icon}</span><div><b>${l.time ? fmtTime(l.time) + ' ' : ''}${HEALTH_TYPES[l.h.type]?.label} — ${hn(l.h.horse_id)}</b> <small>${[l.h.practitioner, l.h.product, l.h.notes].filter(Boolean).join(' · ')}</small></div></div>`)}
        </div>`)}
      </div>
    </div>`}
  </section>`;
}
