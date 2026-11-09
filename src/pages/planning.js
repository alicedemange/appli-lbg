import { html, useState, useMemo, useEffect } from '../lib.js';
import { db } from '../db.js';
import { useApp, Icon, Avatar, AvStack, Modal, openModal, confirmBox, toast, fail, useForm, Field, Seg, ChipPick, Badge, useData, PageHead, Empty, Loading } from '../ui.js';
import { offerCalendar, calFromEvent } from '../calendar.js';
import { openBalade, ChatBox, PhotoLinks, chatOpen } from './chat.js';
import { todayISO, addDays, weekStart, fmtDate, fmtTime, parseISO, DOW, MONTHS, EVENT_TYPES, HEALTH_TYPES, cls, uuid } from '../util.js';

export const PRES_KINDS = {
  monte: { label: 'Je monte', icon: '🏇' },
  soin: { label: 'Soins / pansage', icon: '🧽' },
  passage: { label: 'Passage', icon: '👋' },
  absent: { label: 'Absent·e', icon: '🚫' },
};

// ═════════════════════ PAGE PLANNING ═════════════════════
export function Planning() {
  const app = useApp(); const { me, isAdmin, P, H } = app;
  const [week, setWeek] = useState(weekStart(todayISO()));
  const [show, setShow] = useState(['events', 'presences', 'health']);
  const [view, setView] = useState(() => (innerWidth < 900 ? 'list' : 'grid'));
  const days = [...Array(7)].map((_, i) => addDays(week, i));
  const today = todayISO();

  const [d, reload] = useData(() => loadRange(days[0], days[6], app), [week]);

  useEffect(() => { if (d && view === 'list' && innerWidth < 900) document.querySelector('.day.today')?.scrollIntoView({ block: 'start' }); }, [!!d, view]);

  const items = useMemo(() => {
    if (!d) return {};
    const out = Object.fromEntries(days.map((x) => [x, []]));
    if (show.includes('events')) for (const e of d.events) out[e.date]?.push({ k: 'ev', t: e.start_time || '00:00', e });
    if (show.includes('health')) {
      const g = {};
      for (const s of d.health) { if (!out[s.date] || (!HEALTH_TYPES[s.type]?.track && s.status !== 'prevu')) continue; (g[s.date + s.type + (s.time || '')] ||= { k: 'hs', t: s.time?.slice(0, 5) || '00:01', time: s.time, date: s.date, type: s.type, list: [] }).list.push(s); }
      Object.values(g).forEach((x) => out[x.date].push(x));
    }
    if (show.includes('presences')) for (const p of d.presences) out[p.date]?.push({ k: p.kind === 'absent' ? 'abs' : 'pr', t: p.kind === 'absent' ? '00:02' : (p.time || '23:00'), p });
    for (const k in out) out[k].sort((a, b) => a.t.localeCompare(b.t));
    return out;
  }, [d, show, week]);

  const first = parseISO(days[0]), last = parseISO(days[6]);
  const label = first.getMonth() === last.getMonth() ? `${first.getDate()} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}` : `${first.getDate()} ${MONTHS[first.getMonth()].slice(0, 4)}. – ${last.getDate()} ${MONTHS[last.getMonth()].slice(0, 4)}. ${last.getFullYear()}`;

  const addOn = (date) => {
    if (!isAdmin) return openPresence(app, { date }, reload);
    openModal((close) => html`<${Modal} title=${'Ajouter · ' + fmtDate(date, 'long')} close=${close}>
      <div class="choice-grid">
        <button class="choice" onClick=${() => { close(); openEventForm(app, { date }, reload); }}><span>📅</span><b>Un événement</b><small>Cours, stage, animation, concours…</small></button>
        <button class="choice" onClick=${() => { close(); openPresence(app, { date }, reload); }}><span>🏇</span><b>Une présence / absence</b><small>Qui vient quand</small></button>
        <button class="choice" onClick=${() => { close(); app.openHealth({ date, status: 'prevu' }, reload); }}><span>🔨</span><b>Un RDV soins</b><small>Maréchal, dentiste, ostéo…</small></button>
      </div></${Modal}>`);
  };

  return html`<section class="page planning">
    <${PageHead} title="Planning" sub="Qui vient quand, les cours, les animations et les RDV des pros.">
      <button class="btn" onClick=${() => openPresence(app, { date: today >= days[0] && today <= days[6] ? today : days[0] }, reload)}><span class="emo">🏇</span> Je viens</button>
      <button class="btn ghost" onClick=${() => openPresence(app, { date: today, kind: 'absent' }, reload)}>🚫 Absence</button>
      <button class="btn" onClick=${() => openBalade(app, { date: today >= days[0] && today <= days[6] ? today : days[0] }, reload)}><span class="emo">🌳</span> Balade</button>
      ${isAdmin && html`<button class="btn primary" onClick=${() => openEventForm(app, { date: today }, reload)}><${Icon} n="plus" /> Événement</button>`}
    </${PageHead}>
    <div class="week-bar">
      <div class="week-nav">
        <button class="icon-btn" aria-label="Semaine précédente" onClick=${() => setWeek(addDays(week, -7))}><${Icon} n="left" /></button>
        <button class="btn small ghost" onClick=${() => setWeek(weekStart(today))}>Aujourd'hui</button>
        <button class="icon-btn" aria-label="Semaine suivante" onClick=${() => setWeek(addDays(week, 7))}><${Icon} n="right" /></button>
        <strong class="week-label">${label}</strong>
      </div>
      <div class="week-tools">
        <${ChipPick} value=${show} onChange=${setShow} options=${[['events', 'Événements'], ['presences', 'Présences'], ['health', 'Soins & pros']]} />
        <${Seg} small value=${view} onChange=${setView} options=${[['grid', 'Semaine'], ['list', 'Liste']]} />
      </div>
    </div>
    <div class="legend">${Object.entries(EVENT_TYPES).map(([k, t]) => html`<span><i style=${`background:${t.color}`}></i>${t.label}</span>`)}<span><i class="lg-pr"></i>Présence</span><span><i class="lg-abs"></i>Absence</span></div>
    ${!d ? html`<${Loading} />` : html`
    <div class=${cls('week', view)}>
      ${days.map((x, i) => {
        const dd = parseISO(x);
        return html`<div class=${cls('day', x === today && 'today', x < today && 'past')} key=${x}>
          <div class="day-h"><span class="dow">${DOW[dd.getDay()].slice(0, 3)}.</span><span class="num">${dd.getDate()}</span>
            ${view === 'list' && html`<span class="mon">${MONTHS[dd.getMonth()]}</span>`}
            <button class="day-add" aria-label="Ajouter" onClick=${() => addOn(x)}><${Icon} n="plus" size=${16} /></button></div>
          <div class="day-b">
            ${(items[x] || []).length === 0 && html`<div class="day-empty">—</div>`}
            ${(items[x] || []).map((it) => it.k === 'ev' ? html`<${EventCard} e=${it.e} parts=${d.parts.filter((p) => p.event_id === it.e.id)} reload=${reload} />`
              : it.k === 'hs' ? html`<button class="hs-card" onClick=${() => it.list.length === 1 ? app.openHealth(it.list[0], reload) : isAdmin && app.openHealth({ date: it.date, time: it.time, type: it.type, status: 'prevu' }, reload)}>
                  <span>${HEALTH_TYPES[it.type].icon}</span><span>${it.time && html`<b class="hs-time">${fmtTime(it.time)}</b> `}<b>${HEALTH_TYPES[it.type].label}</b> · ${it.list.map((s) => H[s.horse_id]?.name).join(', ')}
                  ${it.list.some((s) => s.status === 'prevu') && html` <em>prévu</em>`}</span></button>`
              : html`<${PresChip} p=${it.p} reload=${reload} />`)}
          </div></div>`;
      })}
    </div>`}
  </section>`;
}

export async function loadRange(from, to, app) {
  const [events, presences, health] = await Promise.all([
    db.select('events', { gte: { date: from }, lte: { date: to }, order: ['date', 'start_time'] }),
    db.select('presences', { gte: { date: from }, lte: { date: to }, order: 'time' }),
    app.isAdmin ? db.select('health_events', { gte: { date: from }, lte: { date: to } })
      : app.myHorseIds.length ? db.select('health_events', { gte: { date: from }, lte: { date: to }, in: { horse_id: app.myHorseIds } }) : [],
  ]);
  const parts = await db.select('event_participants', { in: { event_id: events.map((e) => e.id) } });
  return { events, presences, health, parts };
}

function EventCard({ e, parts, reload }) {
  const app = useApp(); const T = EVENT_TYPES[e.type] || EVENT_TYPES.info;
  const inn = parts.filter((p) => p.status !== 'absent');
  const mine = parts.find((p) => p.profile_id === app.me.id);
  return html`<button class=${cls('ev-card', mine && 'mine', mine?.status === 'absent' && 'abs')} style=${`--c:${T.color}`} onClick=${() => openEvent(app, e.id, reload)}>
    <span class="ev-top"><span class="ev-time">${fmtTime(e.start_time) || 'Journée'}</span><span class="ev-ic">${T.icon}</span></span>
    <span class="ev-title">${e.title}</span>
    ${e.type === 'sortie' && e.created_by && !app.P[e.created_by]?.role?.startsWith('admin') && html`<small class="ev-by">${e.open === false ? '🧘 en solo · ' : 'proposée par '}${app.P[e.created_by]?.full_name}</small>`}
    ${inn.length > 0 && html`<span class="ev-foot"><${AvStack} people=${inn.map((p) => app.P[p.profile_id] || { full_name: '?' })} max=${4} size=${20} /><small>${inn.length}${e.capacity ? '/' + e.capacity : ''}</small></span>`}
    ${mine && html`<span class="ev-mine">${mine.status === 'absent' ? 'absent·e' : 'inscrit·e'}</span>`}
  </button>`;
}

function PresChip({ p, reload }) {
  const app = useApp(); const who = app.P[p.profile_id]; const K = PRES_KINDS[p.kind] || PRES_KINDS.monte;
  const can = app.isAdmin || p.profile_id === app.me.id;
  const open = () => openModal((close) => html`<${Modal} title=${(who?.full_name || '?') + ' · ' + fmtDate(p.date, 'long')} close=${close} footer=${can && html`
      <button class="btn danger ghost" onClick=${async () => { try { await db.remove('presences', p.id); close(); reload(); toast('Supprimé'); } catch (e) { fail(e); } }}><${Icon} n="trash" size=${16} /> Supprimer</button>
      <button class="btn" onClick=${() => { close(); openPresence(app, p, reload); }}><${Icon} n="edit" size=${16} /> Modifier</button>`}>
      <div class="pres-detail"><${Avatar} p=${who} size=${48} /><div>
        <p><b>${K.icon} ${K.label}</b>${p.time ? ' à ' + fmtTime(p.time) : ''}</p>
        ${p.horse_id && html`<p>🐴 ${app.H[p.horse_id]?.name}</p>`}${p.note && html`<p class="muted">${p.note}</p>`}
        ${who?.phone && html`<p><a class="tel" href=${'tel:' + who.phone.replace(/\s/g, '')}><${Icon} n="phone" size=${14} /> ${who.phone}</a></p>`}
        ${who && who.id !== app.me.id && html`<p><button class="btn small" onClick=${() => { close(); import('./messages.js').then((m) => m.openDirect(app, who.id)); }}><${Icon} n="message" size=${15} /> Écrire à ${who.full_name}</button></p>`}
      </div></div></${Modal}>`);
  return html`<button class=${cls('pres', p.kind, p.profile_id === app.me.id && 'mine')} onClick=${open}>
    <${Avatar} p=${who} size=${20} /><span class="pres-name">${who?.full_name || '?'}</span>
    ${p.kind === 'absent' ? html`<span class="pres-t">abs.</span>` : html`<span class="pres-t">${p.time ? fmtTime(p.time) : ''}${p.kind !== 'monte' ? ' ' + PRES_KINDS[p.kind].icon : ''}</span>`}
  </button>`;
}

// ═════════════════════ PRÉSENCES ═════════════════════
export function openPresence(app, init, reload) {
  openModal((close) => html`<${PresenceForm} init=${init} close=${close} reload=${reload} />`);
}
function PresenceForm({ init, close, reload }) {
  const app = useApp(); const { me, isAdmin, profiles, horses, myHorseIds } = app;
  const f = useForm({ profile_id: me.id, date: todayISO(), time: '', kind: 'monte', horse_id: '', note: '', ...init, time: init.time?.slice(0, 5) || '' });
  const horseOpts = (isAdmin ? app.activeHorses : app.activeHorses.filter((h) => myHorseIds.includes(h.id)));
  const save = async (e) => {
    e.preventDefault();
    const row = { profile_id: f.v.profile_id, date: f.v.date, time: f.v.kind === 'absent' ? null : (f.v.time || null), kind: f.v.kind, horse_id: f.v.horse_id || null, note: f.v.note };
    try {
      init.id ? await db.update('presences', init.id, row) : await db.insert('presences', row); close(); reload?.();
      if (f.v.kind === 'absent') toast('Absence notée');
      else if (row.profile_id === me.id && row.date >= todayISO()) offerCalendar({ uid: 'pres-' + row.date + row.time + '@lbg', title: `Écurie — ${PRES_KINDS[f.v.kind].label}${row.horse_id ? ' (' + app.H[row.horse_id]?.name + ')' : ''}`, date: row.date, start: row.time, description: row.note }, { auto: true, intro: 'Présence ajoutée 🏇' });
      else toast('Présence ajoutée 🏇');
    } catch (er) { fail(er); }
  };
  return html`<${Modal} title=${init.id ? 'Modifier' : f.v.kind === 'absent' ? 'Signaler une absence' : 'Je viens à l’écurie'} close=${close}
    footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="presf">Enregistrer</button>`}>
    <form id="presf" class="form" onSubmit=${save}>
      <${Seg} value=${f.v.kind} onChange=${(k) => f.set('kind', k)} options=${Object.entries(PRES_KINDS).map(([k, x]) => [k, x.icon + ' ' + x.label])} />
      ${isAdmin && html`<${Field} label="Personne"><select ...${f.bind('profile_id')}>${app.members.map((p) => html`<option value=${p.id}>${p.full_name}</option>`)}</select></${Field}>`}
      <div class="row2">
        <${Field} label="Jour"><input type="date" required ...${f.bind('date')} /></${Field}>
        ${f.v.kind !== 'absent' && html`<${Field} label="Heure (approx.)"><input type="time" ...${f.bind('time')} /></${Field}>`}
      </div>
      ${f.v.kind !== 'absent' && horseOpts.length > 0 && html`<${Field} label="Cheval"><select ...${f.bind('horse_id')}><option value="">—</option>${horseOpts.map((h) => html`<option value=${h.id}>${h.name}</option>`)}</select></${Field}>`}
      <${Field} label="Petit mot (optionnel)"><input placeholder=${f.v.kind === 'absent' ? 'Ex. malade, vacances…' : 'Ex. tonte, douche, balade…'} ...${f.bind('note')} /></${Field}>
    </form></${Modal}>`;
}

// ═════════════════════ DÉTAIL ÉVÉNEMENT ═════════════════════
export function openEvent(app, id, reload) {
  openModal((close) => html`<${EventDetail} id=${id} close=${close} reloadParent=${reload} />`);
}
function EventDetail({ id, close, reloadParent }) {
  const app = useApp(); const { me, isAdmin, P, H } = app;
  const [d, reload] = useData(async () => {
    const [e] = await db.select('events', { eq: { id } });
    const parts = await db.select('event_participants', { eq: { event_id: id }, order: 'created_at' });
    return { e, parts };
  }, [id]);
  const refresh = () => { reload(); reloadParent?.(); };
  if (!d) return html`<${Modal} title="…" close=${close}><${Loading} /></${Modal}>`;
  const { e, parts } = d;
  if (!e) return html`<${Modal} title="Événement introuvable" close=${close}><p>Il a peut-être été supprimé.</p></${Modal}>`;
  const T = EVENT_TYPES[e.type] || EVENT_TYPES.info;
  const mine = parts.find((p) => p.profile_id === me.id);
  const inn = parts.filter((p) => p.status !== 'absent');
  const full = e.capacity && inn.length >= e.capacity;
  const own = e.created_by === me.id && !isAdmin;
  const past = e.date < todayISO();
  const solo = e.open === false && e.created_by !== me.id;
  const memberBalade = e.type === 'sortie' && e.created_by && P[e.created_by]?.role !== 'admin';

  const join = async () => {
    const opts = app.activeHorses.filter((h) => app.myHorseIds.includes(h.id));
    try {
      const [p] = await db.insert('event_participants', { event_id: e.id, profile_id: me.id, horse_id: opts.length === 1 ? opts[0].id : null, status: full ? 'attente' : 'inscrit', bring: '', group_label: '', class_name: '', bib: '', result: '', note: '' });
      refresh();
      if (full) toast('Tu es sur liste d’attente'); else offerCalendar(calFromEvent(e, p, app), { auto: true, intro: 'Inscription enregistrée ✨' });
    } catch (er) { fail(er); }
  };
  const leave = async () => { if (await confirmBox('Te désinscrire de cet événement ?', { ok: 'Me désinscrire', danger: true })) { await db.remove('event_participants', mine.id).catch(fail); refresh(); } };
  const del = async () => {
    const serie = e.series_id && await confirmBox('Cet événement fait partie d’une série. Supprimer aussi toutes les dates suivantes ?', { ok: 'Oui, toute la suite' });
    if (!serie && !(await confirmBox('Supprimer cet événement ?', { ok: 'Supprimer', danger: true }))) return;
    try {
      if (serie) { const all = await db.select('events', { eq: { series_id: e.series_id }, gte: { date: e.date } }); for (const x of all) await db.remove('events', x.id); }
      else await db.remove('events', e.id);
      close(); reloadParent?.(); toast('Supprimé');
    } catch (er) { fail(er); }
  };

  return html`<${Modal} wide close=${close} accent=${T.color} icon=${T.icon} title=${e.title}
    footer=${html`
      ${(isAdmin || own) && html`<button class="btn ghost danger" onClick=${del}><${Icon} n="trash" size=${16} /></button>
        <button class="btn ghost" onClick=${() => { close(); memberBalade || own ? openBalade(app, e, reloadParent) : openEventForm(app, e, reloadParent); }}><${Icon} n="edit" size=${16} /> Modifier</button>`}
      <span class="grow"></span>
      ${mine && mine.status !== 'absent' && html`<button class="btn ghost" title="Ajouter à mon agenda" onClick=${() => offerCalendar(calFromEvent(e, mine, app))}>📅 Agenda</button>`}
      ${past ? '' : solo ? html`<span class="muted small">🧘 Balade en solo</span>` : mine ? (e.created_by === me.id ? '' : html`<button class="btn ghost" onClick=${leave}>Me désinscrire</button>`) : html`<button class="btn primary" onClick=${join}><${Icon} n="hand" size=${18} /> ${full ? 'Liste d’attente' : e.type === 'sortie' ? 'Je viens aussi !' : 'Je m’inscris'}</button>`}`}>
    <div class="ev-meta">
      <${Badge} color=${T.color}>${T.label}</${Badge}>
      <span><${Icon} n="calendar" size=${16} /> ${fmtDate(e.date, 'long')}</span>
      ${e.start_time && html`<span><${Icon} n="clock" size=${16} /> ${fmtTime(e.start_time)}${e.end_time ? ' – ' + fmtTime(e.end_time) : ''}</span>`}
      ${e.location && html`<span><${Icon} n="pin" size=${16} /> ${e.location}</span>`}
      <span><${Icon} n="users" size=${16} /> ${inn.length}${e.capacity ? ' / ' + e.capacity : ''} inscrit·e·s</span>
    </div>
    ${memberBalade && html`<p class="ev-by-line"><${Avatar} p=${P[e.created_by]} size=${24} /> ${e.open === false ? html`<b>${P[e.created_by]?.full_name}</b> part seule en balade` : html`Balade proposée par <b>${P[e.created_by]?.full_name}</b> — tout le monde peut se joindre`}</p>`}
    ${e.description && html`<p class="ev-desc">${e.description}</p>`}
    ${e.type === 'concours' ? html`<${ConcoursView} parts=${parts} e=${e} refresh=${refresh} />`
      : e.type === 'stage' ? html`<${StageView} parts=${parts} refresh=${refresh} />`
      : e.type === 'animation' || e.type === 'sortie' ? html`<${AnimView} parts=${parts} refresh=${refresh} />`
      : html`<${SimpleView} parts=${parts} refresh=${refresh} />`}
    ${isAdmin && html`<${AddParticipant} e=${e} parts=${parts} refresh=${refresh} />`}
    ${(e.type === 'concours' || e.type === 'stage' || e.type === 'animation' || e.type === 'sortie' || e.date <= todayISO()) && html`<${PhotoLinks} e=${e} />`}
    ${e.type !== 'cours' && e.open !== false && chatOpen(e) && (mine || isAdmin
      ? html`<${ChatBox} e=${e} parts=${parts} />`
      : !past && html`<div class="chat-locked">💬 Inscris-toi pour rejoindre la discussion et t’organiser avec les autres.</div>`)}
  </${Modal}>`;
}

const canEdit = (app, p) => app.isAdmin || p.profile_id === app.me.id;
const upd = (p, k, refresh) => async (ev) => { const v = ev.target.value; if ((p[k] ?? '') === v) return; try { await db.update('event_participants', p.id, { [k]: v || null }); refresh(); } catch (e) { fail(e); } };

function PartName({ p }) {
  const app = useApp(); const who = app.P[p.profile_id];
  return html`<span class="pname"><${Avatar} p=${who} size=${28} /><span><b>${who?.full_name || '?'}</b>${p.horse_id && html`<small> · ${app.H[p.horse_id]?.name}</small>`}${p.status === 'attente' && html` <${Badge} color="#d38b1f">attente</${Badge}>`}${p.status === 'absent' && html` <${Badge} color="#c2453d">absent·e</${Badge}>`}</span></span>`;
}
function HorsePick({ p, refresh }) {
  const app = useApp();
  const opts = app.isAdmin ? app.activeHorses : app.activeHorses.filter((h) => app.myHorseIds.includes(h.id) || h.id === p.horse_id);
  if (!canEdit(app, p) || !opts.length) return null;
  return html`<select class="mini" value=${p.horse_id || ''} onChange=${upd(p, 'horse_id', refresh)}><option value="">🐴 Cheval…</option>${opts.map((h) => html`<option value=${h.id}>${h.name}</option>`)}</select>`;
}
function AbsToggle({ p, refresh }) {
  const app = useApp(); if (!canEdit(app, p)) return null;
  const abs = p.status === 'absent';
  return html`<button class=${cls('btn small', abs ? 'ghost' : 'ghost danger')} onClick=${async () => { await db.update('event_participants', p.id, { status: abs ? 'inscrit' : 'absent' }).catch(fail); refresh(); }}>${abs ? 'Je viens finalement' : 'Absent·e'}</button>`;
}
function RemoveBtn({ p, refresh }) {
  const app = useApp(); if (!app.isAdmin) return null;
  return html`<button class="icon-btn" aria-label="Retirer" onClick=${async () => { if (await confirmBox('Retirer ' + (app.P[p.profile_id]?.full_name || '') + ' ?', { ok: 'Retirer', danger: true })) { await db.remove('event_participants', p.id).catch(fail); refresh(); } }}><${Icon} n="x" size=${16} /></button>`;
}

function SimpleView({ parts, refresh }) {
  if (!parts.length) return html`<${Empty} icon="🙋" title="Personne pour l’instant" text="Sois la première ou le premier à t’inscrire !" />`;
  return html`<ul class="plist">${parts.map((p) => html`<li class=${p.status}><${PartName} p=${p} /><span class="grow"></span><${HorsePick} p=${p} refresh=${refresh} /><${AbsToggle} p=${p} refresh=${refresh} /><${RemoveBtn} p=${p} refresh=${refresh} /></li>`)}</ul>`;
}

function AnimView({ parts, refresh }) {
  const app = useApp();
  const bring = parts.filter((p) => p.bring);
  return html`
    ${bring.length > 0 && html`<div class="bring-board"><h3>🧺 Qui apporte quoi</h3><div class="bring-grid">${bring.map((p) => html`<div class="bring"><${Avatar} p=${app.P[p.profile_id]} size=${26} /><span><b>${app.P[p.profile_id]?.full_name}</b><br />${p.bring}</span></div>`)}</div></div>`}
    <h3 class="sec">Participant·e·s</h3>
    ${!parts.length ? html`<${Empty} icon="🎉" title="Personne pour l’instant" text="Inscris-toi et dis ce que tu apportes !" />` : html`
    <ul class="plist">${parts.map((p) => html`<li class=${p.status}><${PartName} p=${p} />
      ${canEdit(app, p) ? html`<input class="mini grow" placeholder="J’apporte…" value=${p.bring || ''} onBlur=${upd(p, 'bring', refresh)} />` : html`<span class="grow muted">${p.bring || ''}</span>`}
      <${RemoveBtn} p=${p} refresh=${refresh} /></li>`)}</ul>`}`;
}

function StageView({ parts, refresh }) {
  const app = useApp();
  const groups = {};
  for (const p of parts.filter((x) => x.status !== 'absent')) (groups[p.group_label || 'À répartir'] ||= []).push(p);
  const keys = Object.keys(groups).sort((a, b) => (a === 'À répartir') - (b === 'À répartir') || a.localeCompare(b));
  const absents = parts.filter((x) => x.status === 'absent');
  return html`
    <div class="groups">${keys.map((g) => {
      const t = groups[g].map((p) => p.slot_time).filter(Boolean).sort()[0];
      return html`<div class=${cls('group', g === 'À répartir' && 'todo')}><div class="group-h"><b>${g}</b>${t && html`<span>⏱ ${fmtTime(t)}</span>`}</div>
        ${groups[g].map((p) => html`<div class="group-row"><${PartName} p=${p} />
          ${app.isAdmin ? html`<span class="group-edit"><input class="mini" list="grp-list" placeholder="Groupe" value=${p.group_label || ''} onBlur=${upd(p, 'group_label', refresh)} />
            <input class="mini" type="time" value=${p.slot_time?.slice(0, 5) || ''} onBlur=${upd(p, 'slot_time', refresh)} /></span>` : html`<${HorsePick} p=${p} refresh=${refresh} />`}
          <${AbsToggle} p=${p} refresh=${refresh} /></div>`)}</div>`;
    })}</div>
    <datalist id="grp-list">${['Groupe 1', 'Groupe 2', 'Groupe 3', 'Groupe 4'].map((g) => html`<option value=${g} />`)}</datalist>
    ${!parts.length && html`<${Empty} icon="⭐" title="Pas encore d’inscrit" text="Inscris-toi : Nathalie fera les groupes de passage." />`}
    ${absents.length > 0 && html`<p class="muted small">Absent·e·s : ${absents.map((p) => app.P[p.profile_id]?.full_name + (p.note ? ` (${p.note})` : '')).join(', ')}</p>`}
    ${app.isAdmin && html`<p class="hint">💡 Tape le nom du groupe et l’heure de passage pour chaque cavalier : la feuille se range toute seule.</p>`}`;
}

function ConcoursView({ parts, refresh }) {
  const app = useApp();
  const sorted = [...parts].sort((a, b) => (a.class_time || '99').localeCompare(b.class_time || '99'));
  if (!parts.length) return html`<${Empty} icon="🏆" title="Pas encore d’engagé" text="Inscris-toi, puis ajoute ton épreuve, ton dossard et ton heure de passage." />`;
  return html`<h3 class="sec">📋 Feuille de route</h3>
    <div class="roadmap">${sorted.map((p) => {
      const ed = canEdit(app, p);
      return html`<div class=${cls('rm-row', p.status)}>
        <div class="rm-time">${p.class_time ? fmtTime(p.class_time) : '—'}</div>
        <div class="rm-main"><${PartName} p=${p} />
          ${ed ? html`<div class="rm-fields">
              <${HorsePick} p=${p} refresh=${refresh} />
              <input class="mini" placeholder="Épreuve (ex. Club 1)" value=${p.class_name || ''} onBlur=${upd(p, 'class_name', refresh)} />
              <input class="mini bib-in" placeholder="Dossard" value=${p.bib || ''} onBlur=${upd(p, 'bib', refresh)} />
              <input class="mini" type="time" title="Heure de passage" value=${p.class_time?.slice(0, 5) || ''} onBlur=${upd(p, 'class_time', refresh)} />
              <input class="mini" placeholder="Résultat / classement" value=${p.result || ''} onBlur=${upd(p, 'result', refresh)} />
            </div>` : html`<div class="rm-ro">${p.class_name && html`<span>${p.class_name}</span>`}${p.result && html`<span>🏅 ${p.result}</span>`}${p.note && html`<span class="muted">${p.note}</span>`}</div>`}
        </div>
        <div class="bib">${p.bib ? html`<small>N°</small>${p.bib}` : html`<small>dossard</small>?`}</div>
        <${RemoveBtn} p=${p} refresh=${refresh} />
      </div>`;
    })}</div>`;
}

function AddParticipant({ e, parts, refresh }) {
  const app = useApp(); const [pid, setPid] = useState('');
  const avail = app.members.filter((p) => !parts.some((x) => x.profile_id === p.id));
  if (!avail.length) return null;
  const add = async () => { if (!pid) return; await db.insert('event_participants', { event_id: e.id, profile_id: pid, status: 'inscrit', bring: '', group_label: '', class_name: '', bib: '', result: '', note: '' }).catch(fail); setPid(''); refresh(); };
  return html`<div class="add-part"><select value=${pid} onChange=${(ev) => setPid(ev.target.value)}><option value="">＋ Inscrire quelqu’un…</option>${avail.map((p) => html`<option value=${p.id}>${p.full_name}</option>`)}</select><button class="btn small" onClick=${add} disabled=${!pid}>Ajouter</button></div>`;
}

// ═════════════════════ FORMULAIRE ÉVÉNEMENT (admin) ═════════════════════
export function openEventForm(app, init, reload, after) {
  openModal((close) => html`<${EventForm} init=${init} close=${close} reload=${reload} after=${after} />`);
}
function EventForm({ init, close, reload, after }) {
  const app = useApp();
  const f = useForm({ type: 'cours', title: '', date: todayISO(), start_time: '', end_time: '', location: '', description: '', capacity: '', repeat: 1, people: [], ...init,
    start_time: init.start_time?.slice(0, 5) || '', end_time: init.end_time?.slice(0, 5) || '', capacity: init.capacity ?? '' });
  const editing = !!init.id;
  const defaults = { cours: 'Cours collectif', animation: '', stage: 'Stage avec ', concours: 'CSO ', sortie: 'Balade ', info: '' };
  const save = async (ev) => {
    ev.preventDefault();
    const base = { type: f.v.type, title: f.v.title.trim() || EVENT_TYPES[f.v.type].label, start_time: f.v.start_time || null, end_time: f.v.end_time || null, location: f.v.location, description: f.v.description, capacity: f.v.capacity ? Number(f.v.capacity) : null };
    try {
      if (editing) { await db.update('events', init.id, { ...base, date: f.v.date }); }
      else {
        const n = Math.max(1, Math.min(52, Number(f.v.repeat) || 1)); const series_id = n > 1 ? uuid() : null;
        const rows = [...Array(n)].map((_, i) => ({ ...base, date: addDays(f.v.date, i * 7), series_id }));
        const created = await db.insert('events', rows);
        if (f.v.people.length) await db.insert('event_participants', created.flatMap((e) => f.v.people.map((pid) => ({ event_id: e.id, profile_id: pid, status: 'inscrit', bring: '', group_label: '', class_name: '', bib: '', result: '', note: '' }))));
        after?.(created[0]);
      }
      close(); reload?.(); toast(editing ? 'Modifié' : 'Événement créé 📅');
    } catch (er) { fail(er); }
  };
  return html`<${Modal} title=${editing ? 'Modifier l’événement' : 'Nouvel événement'} close=${close} accent=${EVENT_TYPES[f.v.type].color}
    footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="evf">${editing ? 'Enregistrer' : 'Créer'}</button>`}>
    <form id="evf" class="form" onSubmit=${save}>
      <div class="type-pick">${Object.entries(EVENT_TYPES).map(([k, t]) => html`<button type="button" class=${cls(f.v.type === k && 'on')} style=${`--c:${t.color}`} onClick=${() => { f.set('type', k); if (!f.v.title || Object.values(defaults).includes(f.v.title)) f.set('title', defaults[k]); }}><span>${t.icon}</span>${t.label}</button>`)}</div>
      <${Field} label="Titre"><input required placeholder="Ex. Raclette party, Stage avec Olivier, CSO La Millassolle…" ...${f.bind('title')} /></${Field}>
      <div class="row3">
        <${Field} label="Date"><input type="date" required ...${f.bind('date')} /></${Field}>
        <${Field} label="Début"><input type="time" ...${f.bind('start_time')} /></${Field}>
        <${Field} label="Fin"><input type="time" ...${f.bind('end_time')} /></${Field}>
      </div>
      <div class="row2">
        <${Field} label="Lieu"><input list="lieux" placeholder="Carrière, manège, extérieur…" ...${f.bind('location')} /></${Field}>
        <${Field} label="Places max" hint="Vide = illimité"><input type="number" min="1" ...${f.bind('capacity')} /></${Field}>
      </div>
      <datalist id="lieux">${['Carrière', 'Manège', 'Rond de longe', 'Club-house', 'Extérieur'].map((l) => html`<option value=${l} />`)}</datalist>
      <${Field} label="Infos utiles"><textarea rows="3" placeholder="Programme, matériel à prévoir, horaires du camion…" ...${f.bind('description')}></textarea></${Field}>
      ${!editing && html`
        <${Field} label="Répéter chaque semaine" hint="Pratique pour les cours collectifs : crée la même séance sur plusieurs semaines."><select ...${f.bind('repeat')}>${[1, 2, 4, 8, 12, 26, 52].map((n) => html`<option value=${n}>${n === 1 ? 'Non, une seule fois' : n + ' semaines'}</option>`)}</select></${Field}>
        <${Field} label="Inscrire directement"><${ChipPick} value=${f.v.people} onChange=${(v) => f.set('people', v)} options=${app.members.map((p) => [p.id, p.full_name])} /></${Field}>`}
    </form></${Modal}>`;
}
