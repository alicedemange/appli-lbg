// Ajout d'un RDV à l'agenda du téléphone : fichier .ics (iPhone, Android, Outlook) ou lien Google Agenda.
import { html } from './lib.js';
import { Modal, openModal, Icon, toast } from './ui.js';
import { addDays, fmtDate, fmtTime, downloadText } from './util.js';
import { CONFIG } from '../config.js';

const LIEU = 'Écuries la Barthe Grande';
const stamp = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.slice(0, 5).replace(':', '') + '00' : '');
const esc = (s = '') => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m);
function endOf(date, start, end) {
  if (end) return end;
  const [h, m] = start.slice(0, 5).split(':').map(Number);
  const t = h * 60 + m + 60;
  return t >= 24 * 60 ? '23:59' : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** ev = { title, date, start, end, location, description, uid } */
export function buildIcs(ev) {
  const timed = !!ev.start;
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LBG//Appli ecurie//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.uid || Date.now() + '@lbg'}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    timed ? `DTSTART:${stamp(ev.date, ev.start)}` : `DTSTART;VALUE=DATE:${stamp(ev.date)}`,
    timed ? `DTEND:${stamp(ev.date, endOf(ev.date, ev.start, ev.end))}` : `DTEND;VALUE=DATE:${stamp(addDays(ev.date, 1))}`,
    `SUMMARY:${esc(ev.title)}`,
    `LOCATION:${esc(ev.location ? `${ev.location} — ${LIEU}` : LIEU)}`,
    `DESCRIPTION:${esc(ev.description || '')}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)}`, timed ? 'TRIGGER:-PT1H' : 'TRIGGER:-PT15H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}
export function googleUrl(ev) {
  const timed = !!ev.start;
  const dates = timed ? `${stamp(ev.date, ev.start)}/${stamp(ev.date, endOf(ev.date, ev.start, ev.end))}` : `${stamp(ev.date)}/${stamp(addDays(ev.date, 1))}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates, ctz: 'Europe/Paris', details: ev.description || '', location: ev.location ? `${ev.location} — ${LIEU}` : LIEU });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function saveIcs(ev) {
  const ics = buildIcs(ev);
  const name = (ev.title || 'rdv').normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) + '.ics';
  if (window.claude?.use) { toast('Aperçu Claude : le fichier agenda fonctionnera dans la vraie appli (ici, utilise Google Agenda)', 'err'); return false; }
  if (isIOS()) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
  await downloadText(name, ics, 'text/calendar', false);
}

const KEY = 'lbg-agenda-ask';
export const wantsAsk = () => { try { return localStorage.getItem(KEY) !== 'non'; } catch (e) { return true; } };
const setAsk = (v) => { try { localStorage.setItem(KEY, v ? 'oui' : 'non'); } catch (e) {} };

/** Fenêtre « Ajouter à mon agenda ». auto = proposé automatiquement après une saisie. */
export function offerCalendar(ev, { auto = false, intro } = {}) {
  if (auto && !wantsAsk()) return;
  openModal((close) => html`<${Modal} title="Ajouter à mon agenda ?" icon="📅" close=${close}>
    ${intro && html`<p><b>${intro}</b></p>`}
    <div class="cal-card"><b>${ev.title}</b><span>${fmtDate(ev.date, 'long')}${ev.start ? ' · ' + fmtTime(ev.start) + (ev.end ? ' – ' + fmtTime(ev.end) : '') : ' · toute la journée'}</span>${ev.location && html`<span>📍 ${ev.location}</span>`}</div>
    <div class="cal-btns">
      <button class="btn primary big" onClick=${async () => { if ((await saveIcs(ev)) !== false) { close(); toast('Ouvre le fichier pour l’ajouter à ton agenda 📅'); } }}><span class="emo">📱</span> iPhone, Android, Outlook</button>
      <a class="btn big" href=${googleUrl(ev)} target="_blank" rel="noopener" onClick=${() => setTimeout(close, 300)}><span class="emo">🗓️</span> Google Agenda</a>
    </div>
    <p class="hint">Un rappel est réglé 1 h avant (la veille au soir pour un RDV sur la journée).</p>
    ${auto && html`<label class="check small"><input type="checkbox" onChange=${(e) => setAsk(!e.target.checked)} /> Ne plus me le proposer automatiquement (le bouton 📅 reste dans chaque événement)</label>`}
    <div class="right"><button class="btn ghost" onClick=${close}>Non merci</button></div>
  </${Modal}>`);
}

// ── Constructeurs pratiques ──────────────────────────────────
export function calFromEvent(e, part, app) {
  const lines = [e.description];
  if (part?.horse_id) lines.push('Cheval : ' + (app.H[part.horse_id]?.name || ''));
  if (part?.group_label) lines.push(`Groupe : ${part.group_label}${part.slot_time ? ' à ' + fmtTime(part.slot_time) : ''}`);
  if (part?.class_name) lines.push('Épreuve : ' + part.class_name);
  if (part?.bib) lines.push('Dossard : ' + part.bib);
  if (part?.class_time) lines.push('Heure de passage : ' + fmtTime(part.class_time));
  if (part?.bring) lines.push("J'apporte : " + part.bring);
  lines.push('— ' + (CONFIG.NOM_ECURIE || LIEU));
  return { uid: e.id + '@lbg', title: e.title, date: e.date, start: e.start_time, end: e.end_time, location: e.location, description: lines.filter(Boolean).join('\n') };
}
