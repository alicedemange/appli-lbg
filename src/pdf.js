// Export PDF : dossier d'un membre (ses chevaux, carnet de santé, documents, participations).
import { db } from './db.js';
import { LOGO_URL } from './ui.js';
import { fmtDate, fmtTime, HEALTH_TYPES, EVENT_TYPES, ROLES, SEXES, PENSIONS, todayISO, downloadText } from './util.js';
import { DOC_KINDS } from './pages/documents.js';

const NAVY = [36, 65, 95], BROWN = [122, 92, 79], MUTED = [111, 103, 93], LINE = [231, 221, 208];
// Helvetica (police PDF standard) ne connaît ni les emojis ni certains signes : on nettoie.
const clean = (s) => String(s ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/·/g, '-').replace(/[^\x00-\xFF€–—…•]/g, '').replace(/\s+\n/g, '\n').trim();

async function toDataUrl(src) {
  if (src.startsWith('data:')) return src;
  const b = await (await fetch(src)).blob();
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
}

class Doc {
  constructor(jsPDF) { this.pdf = new jsPDF({ unit: 'mm', format: 'a4' }); this.y = 20; this.W = 210; this.M = 14; }
  ensure(h) { if (this.y + h > 282) { this.pdf.addPage(); this.y = 18; } }
  h1(t) { this.ensure(16); this.y += 4; this.pdf.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...NAVY); this.pdf.text(clean(t), this.M, this.y); this.y += 2; this.pdf.setDrawColor(...BROWN).setLineWidth(0.6).line(this.M, this.y, this.M + 30, this.y); this.y += 6; }
  h2(t) { this.ensure(12); this.y += 2; this.pdf.setFont('helvetica', 'bold').setFontSize(11.5).setTextColor(...BROWN); this.pdf.text(clean(t), this.M, this.y); this.y += 5; }
  p(t, { size = 9.5, color = [30, 40, 50] } = {}) {
    this.pdf.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...color);
    const lines = this.pdf.splitTextToSize(clean(t), this.W - 2 * this.M);
    for (const l of lines) { this.ensure(5); this.pdf.text(l, this.M, this.y); this.y += size * 0.45; }
    this.y += 1.5;
  }
  kv(pairs) {
    const col = (this.W - 2 * this.M) / 2; let i = 0;
    for (const [k, v] of pairs.filter(([, v]) => v)) {
      if (i % 2 === 0) this.ensure(6);
      const x = this.M + (i % 2) * col;
      this.pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED).text(clean(k), x, this.y);
      this.pdf.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(30, 40, 50).text(clean(v).slice(0, 60), x + 34, this.y);
      if (i % 2 === 1) this.y += 5.5; i++;
    }
    if (i % 2 === 1) this.y += 5.5;
    this.y += 2;
  }
  table(cols, rows) {
    const pdf = this.pdf; const total = cols.reduce((a, c) => a + c.w, 0); const scale = (this.W - 2 * this.M) / total;
    const ws = cols.map((c) => c.w * scale);
    const head = () => { this.ensure(9); pdf.setFillColor(...NAVY).rect(this.M, this.y - 4.2, this.W - 2 * this.M, 6.5, 'F'); pdf.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(255, 255, 255);
      let x = this.M + 1.5; cols.forEach((c, i) => { pdf.text(clean(c.h), x, this.y); x += ws[i]; }); this.y += 5; };
    head();
    if (!rows.length) { this.p('Aucune donnée.', { size: 9, color: MUTED }); return; }
    pdf.setFont('helvetica', 'normal').setFontSize(8.5);
    rows.forEach((r, ri) => {
      const cells = r.map((v, i) => pdf.splitTextToSize(clean(v), ws[i] - 3));
      const hgt = Math.max(...cells.map((c) => c.length)) * 3.8 + 2;
      if (this.y + hgt > 282) { pdf.addPage(); this.y = 18; head(); pdf.setFont('helvetica', 'normal').setFontSize(8.5); }
      if (ri % 2) { pdf.setFillColor(248, 243, 236).rect(this.M, this.y - 3.6, this.W - 2 * this.M, hgt, 'F'); }
      pdf.setTextColor(30, 40, 50);
      let x = this.M + 1.5; cells.forEach((c, i) => { pdf.text(c, x, this.y); x += ws[i]; });
      this.y += hgt;
    });
    pdf.setDrawColor(...LINE).setLineWidth(0.2).line(this.M, this.y - 2.5, this.W - this.M, this.y - 2.5); this.y += 3;
  }
  footer(text) {
    const n = this.pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) { this.pdf.setPage(i); this.pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED); this.pdf.text(clean(`${text} — page ${i}/${n}`), this.W / 2, 291, { align: 'center' }); }
  }
}

async function header(d, title, sub) {
  try { const logo = await toDataUrl(LOGO_URL); d.pdf.addImage(logo, 'PNG', d.M, 10, 42, 27); } catch (e) { /* logo facultatif */ }
  d.pdf.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...NAVY).text(clean(title), 64, 22);
  d.pdf.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...MUTED).text(clean(sub), 64, 28);
  d.pdf.text(clean(`Document généré le ${fmtDate(todayISO(), 'full')}`), 64, 33);
  d.y = 46;
}

async function horseSection(d, app, h, evts, docs) {
  d.h1(`Cheval : ${h.name}`);
  d.kv([['Propriétaire', app.ownerName(h)], ['Sexe', SEXES[h.sex]], ['Né(e) le', h.birth_date && fmtDate(h.birth_date)], ['Race', h.breed], ['Robe', h.robe], ['Taille', h.height && h.height + ' cm'],
    ['UELN', h.ueln], ['N° SIRE', h.sire], ['Transpondeur', h.transponder], ['Formule', PENSIONS[h.pension]], ['Arrivé(e) le', h.arrival_date && fmtDate(h.arrival_date)], ['Provenance', h.origin],
    ['Sorti(e) le', h.departure_date && fmtDate(h.departure_date)], ['Destination', h.destination]]);
  if (h.ration_morning || h.ration_evening || h.supplements) { d.h2('Ration'); d.p(`Matin : ${h.ration_morning || '-'}\nSoir : ${h.ration_evening || '-'}${h.supplements ? '\nCompléments : ' + h.supplements : ''}`); }
  if (h.notes) { d.h2('À savoir'); d.p(h.notes); }
  d.h2('Carnet de santé');
  d.table([{ h: 'Date', w: 20 }, { h: 'Soin', w: 22 }, { h: 'Intervenant', w: 26 }, { h: 'Produit / lot', w: 34 }, { h: 'Observations', w: 60 }],
    evts.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || ''))).map((e) => [fmtDate(e.date) + (e.time ? ' ' + fmtTime(e.time) : '') + (e.status === 'prevu' ? ' (prévu)' : ''), HEALTH_TYPES[e.type]?.label, e.practitioner, [e.product, e.lot && 'lot ' + e.lot].filter(Boolean).join(' - '), e.notes]));
  if (docs) {
    d.h2('Contrat & documents');
    d.table([{ h: 'Document', w: 70 }, { h: 'Type', w: 30 }, { h: 'Ajouté le', w: 22 }, { h: 'Acceptation', w: 50 }],
      docs.map((x) => [x.title, DOC_KINDS[x.kind]?.label, fmtDate(x.created_at.slice(0, 10)), x.needs_acceptance ? (x.accepted_at ? `Accepté par ${x.accepted_name} le ${fmtDate(x.accepted_at.slice(0, 10))}` : 'En attente') : '-']));
  }
}

async function jspdf() { const m = await import('jspdf'); return m.jsPDF || m.default; }

/** Dossier complet d'un membre (propriétaire ou DP/TP). */
export async function dossierPdf(app, p) {
  const jsPDF = await jspdf(); const d = new Doc(jsPDF);
  const owned = app.horses.filter((h) => h.owner_id === p.id);
  const ridden = app.riders.filter((r) => r.profile_id === p.id).map((r) => app.H[r.horse_id]).filter(Boolean);
  const all = [...owned, ...ridden.filter((h) => !owned.includes(h))];
  const ids = all.map((h) => h.id);
  const [health, docs, parts] = await Promise.all([
    ids.length ? db.select('health_events', { in: { horse_id: ids } }) : [],
    owned.length ? db.select('documents', { in: { horse_id: owned.map((h) => h.id) } }) : [],
    db.select('event_participants', { eq: { profile_id: p.id } }),
  ]);
  const events = await db.select('events', { in: { id: parts.map((x) => x.event_id) }, order: '-date' });
  await header(d, `Dossier de ${p.full_name}`, `${ROLES[p.role]?.label || ''} - Écuries la Barthe Grande`);
  d.h1('Coordonnées');
  d.kv([['Nom', p.full_name], ['Statut', ROLES[p.role]?.label], ['Téléphone', p.phone], ['E-mail', p.email], ['Licence FFE', p.licence_ffe && `${p.licence_ffe} (${p.licence_year || '?'})`],
    ['Chevaux', owned.map((h) => h.name).join(', ')], ['Monte en DP/TP', ridden.map((h) => h.name).join(', ')]]);
  for (const h of all) await horseSection(d, app, h, health.filter((e) => e.horse_id === h.id), owned.includes(h) ? docs.filter((x) => x.horse_id === h.id) : null);
  d.h1('Participations à la vie de l’écurie');
  d.table([{ h: 'Date', w: 20 }, { h: 'Événement', w: 50 }, { h: 'Cheval', w: 24 }, { h: 'Détails', w: 70 }],
    events.map((e) => { const x = parts.find((q) => q.event_id === e.id) || {};
      return [fmtDate(e.date), `${EVENT_TYPES[e.type]?.label} - ${e.title}`, app.H[x.horse_id]?.name || '', [x.status === 'absent' && 'absent(e)', x.group_label, x.class_name, x.bib && 'dossard ' + x.bib, x.class_time && 'passage ' + fmtTime(x.class_time), x.result && 'résultat : ' + x.result, x.bring && 'apporte : ' + x.bring].filter(Boolean).join(' - ')]; }));
  d.footer(`Dossier de ${p.full_name} - Écuries la Barthe Grande`);
  await save(d, `dossier-${p.full_name}`);
}

/** Carnet d'un seul cheval. */
export async function horsePdf(app, h) {
  const jsPDF = await jspdf(); const d = new Doc(jsPDF);
  const canDocs = app.canManageHorse(h);
  const [health, docs] = await Promise.all([db.select('health_events', { eq: { horse_id: h.id } }), canDocs ? db.select('documents', { eq: { horse_id: h.id } }) : null]);
  await header(d, `Carnet de ${h.name}`, 'Écuries la Barthe Grande');
  await horseSection(d, app, h, health, docs);
  d.footer(`Carnet de ${h.name} - Écuries la Barthe Grande`);
  await save(d, `carnet-${h.name}`);
}

async function save(d, base) {
  const name = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').toLowerCase() + '.pdf';
  if (window.claude?.use) {
    try { const dl = await window.claude.use('downloads'); if (dl) { await dl.save({ filename: name, data: d.pdf.output('blob') }); return; } } catch (e) { return; }
  }
  d.pdf.save(name);
}
void downloadText;
