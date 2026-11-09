// Contrat de pension & documents d'un cheval (visibles par l'admin et le propriétaire uniquement).
import { html, useState } from '../lib.js';
import { db, uploadDoc, docUrl, removeDocFile, acceptDoc } from '../db.js';
import { useApp, Icon, Modal, openModal, confirmBox, toast, fail, useForm, Field, ChipPick, Badge, useData, Empty, Loading } from '../ui.js';
import { fmtDate, cls } from '../util.js';

export const DOC_KINDS = {
  contrat: { label: 'Contrat de pension', icon: '📝' },
  avenant: { label: 'Avenant', icon: '✍️' },
  reglement: { label: 'Règlement intérieur', icon: '📜' },
  ordonnance: { label: 'Ordonnance', icon: '💊' },
  assurance: { label: 'Assurance', icon: '🛡️' },
  autre: { label: 'Autre', icon: '📎' },
};
const fmtStamp = (iso) => iso ? `${fmtDate(iso.slice(0, 10))} à ${new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '';

async function saveBlob(blob, name) {
  if (window.claude?.use) { try { const dl = await window.claude.use('downloads'); if (dl) { await dl.save({ filename: name, data: blob }); return; } } catch (e) { return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
export async function openDoc(d) {
  if (!d.file_path) return toast('Pas de fichier joint à ce document', 'err');
  const w = d.file_path.startsWith('data:') ? null : window.open('', '_blank');
  try {
    const url = await docUrl(d);
    if (w) { w.location = url; return; }
    // Mode démo : aperçu dans une fenêtre
    const blob = await (await fetch(url)).blob(); const bu = URL.createObjectURL(blob);
    openModal((close) => html`<${Modal} wide title=${d.title} close=${close} footer=${html`<button class="btn" onClick=${() => saveBlob(blob, d.file_name || 'document.pdf')}><${Icon} n="download" size=${16} /> Télécharger</button><button class="btn primary" onClick=${close}>J’ai lu</button>`}>
      ${blob.type.startsWith('image/') ? html`<img src=${bu} style="max-width:100%" />` : html`<iframe class="doc-frame" src=${bu} title=${d.title}></iframe>`}</${Modal}>`);
  } catch (e) { w?.close(); fail(e); }
}

export function DocumentsCard({ h }) {
  const app = useApp();
  const [docs, reload] = useData(() => db.select('documents', { eq: { horse_id: h.id }, order: '-created_at' }), [h.id]);
  if (!docs) return html`<${Loading} />`;
  const pending = docs.filter((d) => d.needs_acceptance && !d.accepted_at);
  const isOwner = h.owner_id === app.me.id;
  return html`<div class="card">
    <div class="card-h"><div><h3 style="margin:0">📄 Contrat & documents</h3><small class="muted">Visibles uniquement par ${app.isAdmin ? 'toi et le propriétaire' : 'toi et l’écurie'} — pas par les DP/TP.</small></div>
      <button class="btn primary" onClick=${() => openDocForm(app, h, reload)}><${Icon} n="plus" /> Ajouter</button></div>
    ${pending.length > 0 && isOwner && html`<div class="doc-alert">📝 <b>${pending.length} document${pending.length > 1 ? 's' : ''} à lire et accepter</b></div>`}
    ${!docs.length ? html`<${Empty} icon="📄" title="Aucun document" text=${app.isAdmin ? 'Ajoute le contrat de pension : le propriétaire le lira et l’acceptera depuis l’appli.' : 'Le contrat de pension apparaîtra ici quand l’écurie l’aura ajouté.'} />` : html`
    <ul class="docs">${docs.map((d) => { const K = DOC_KINDS[d.kind] || DOC_KINDS.autre;
      return html`<li class=${cls('doc', d.needs_acceptance && !d.accepted_at && 'todo')}>
        <span class="doc-ic">${K.icon}</span>
        <div class="doc-b"><b>${d.title}</b><small>${K.label} · ajouté le ${fmtDate(d.created_at.slice(0, 10))}${d.file_name ? ' · ' + d.file_name : ''}</small>
          ${d.needs_acceptance && (d.accepted_at ? html`<span class="doc-ok">✅ Lu et accepté par <b>${d.accepted_name}</b> le ${fmtStamp(d.accepted_at)}</span>` : html`<span class="doc-wait">⏳ En attente d’acceptation du propriétaire</span>`)}
        </div>
        <div class="doc-act">
          ${d.file_path && html`<button class="btn small ghost" onClick=${() => openDoc(d)}>Ouvrir</button>`}
          ${d.needs_acceptance && !d.accepted_at && isOwner && html`<button class="btn small primary" onClick=${() => openAccept(app, d, reload)}>Lire et accepter</button>`}
          ${(app.isAdmin || (d.created_by === app.me.id && !d.accepted_at)) && html`<button class="icon-btn" aria-label="Supprimer" onClick=${async () => { if (await confirmBox(`Supprimer « ${d.title} » ?`, { ok: 'Supprimer', danger: true })) { try { await removeDocFile(d); await db.remove('documents', d.id); reload(); } catch (e) { fail(e); } } }}><${Icon} n="trash" size=${16} /></button>`}
        </div></li>`; })}</ul>`}
  </div>`;
}

function openDocForm(app, h, reload) { openModal((close) => html`<${DocForm} h=${h} close=${close} reload=${reload} />`); }
function DocForm({ h, close, reload }) {
  const app = useApp();
  const f = useForm({ kind: app.isAdmin ? 'contrat' : 'ordonnance', title: '', needs_acceptance: app.isAdmin, horse_ids: [h.id] });
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      for (const horse_id of f.v.horse_ids) {
        const up = file ? await uploadDoc(horse_id, file) : { file_path: null, file_name: null };
        await db.insert('documents', { horse_id, kind: f.v.kind, title: f.v.title.trim() || DOC_KINDS[f.v.kind].label, needs_acceptance: app.isAdmin && f.v.needs_acceptance, ...up });
      }
      close(); reload(); toast(f.v.needs_acceptance && app.isAdmin ? 'Document envoyé : le propriétaire le verra à sa prochaine connexion ✉️' : 'Document ajouté');
    } catch (er) { fail(er); }
    setBusy(false);
  };
  return html`<${Modal} title="Ajouter un document" icon="📄" close=${close} footer=${html`<button class="btn ghost" onClick=${close}>Annuler</button><button class="btn primary" form="docf" disabled=${busy}>${busy ? 'Envoi…' : 'Enregistrer'}</button>`}>
    <form id="docf" class="form" onSubmit=${save}>
      <div class="type-pick">${Object.entries(DOC_KINDS).filter(([k]) => app.isAdmin || !['contrat', 'avenant', 'reglement'].includes(k)).map(([k, x]) => html`<button type="button" style="--c:#7a5c4f" class=${cls(f.v.kind === k && 'on')} onClick=${() => { f.set('kind', k); f.set('needs_acceptance', app.isAdmin && ['contrat', 'avenant', 'reglement'].includes(k)); }}><span>${x.icon}</span>${x.label}</button>`)}</div>
      <${Field} label="Titre"><input placeholder=${f.v.kind === 'contrat' ? 'Ex. Contrat de pension 2027 — formule Plus' : 'Titre du document'} ...${f.bind('title')} /></${Field}>
      <${Field} label="Fichier (PDF ou photo)" hint="Le fichier est stocké de façon privée : seuls l’écurie et le propriétaire peuvent l’ouvrir."><input type="file" accept="application/pdf,image/*" onChange=${(e) => setFile(e.target.files[0] || null)} /></${Field}>
      ${app.isAdmin && html`
        <label class="check"><input type="checkbox" checked=${f.v.needs_acceptance} onChange=${(e) => f.set('needs_acceptance', e.target.checked)} /> Le propriétaire doit le lire et l’accepter dans l’appli</label>
        <${Field} label="Pour quel(s) cheval / chevaux ?" hint="Astuce : coche plusieurs chevaux pour envoyer le même contrat ou règlement à tout le monde."><${ChipPick} value=${f.v.horse_ids} onChange=${(v) => f.set('horse_ids', v)} options=${app.activeHorses.map((x) => [x.id, x.name + (x.owner_id ? '' : ' (sans compte)')])} /></${Field}>`}
    </form></${Modal}>`;
}

export function openAccept(app, d, reload) { openModal((close) => html`<${AcceptForm} d=${d} close=${close} reload=${reload} />`); }
function AcceptForm({ d, close, reload }) {
  const app = useApp();
  const [ok, setOk] = useState(false); const [name, setName] = useState(app.me.full_name || ''); const [opened, setOpened] = useState(!d.file_path);
  const go = async (e) => { e.preventDefault(); try { await acceptDoc(d.id, name.trim(), app.me.id); close(); reload?.(); toast('Merci ! Document accepté ✅'); } catch (er) { fail(er); } };
  return html`<${Modal} title="Lire et accepter" icon="📝" close=${close} footer=${html`<button class="btn ghost" onClick=${close}>Plus tard</button><button class="btn primary" form="accf" disabled=${!ok || !name.trim() || !opened}>J’accepte</button>`}>
    <form id="accf" class="form" onSubmit=${go}>
      <div class="cal-card"><b>${d.title}</b><span>${app.H[d.horse_id]?.name} · ${DOC_KINDS[d.kind]?.label}</span></div>
      ${d.file_path && html`<button type="button" class="btn big" onClick=${() => { openDoc(d); setOpened(true); }}>📖 Ouvrir le document</button>`}
      <label class="check"><input type="checkbox" checked=${ok} onChange=${(e) => setOk(e.target.checked)} /> J’ai lu ce document et j’en accepte les conditions.</label>
      <${Field} label="Ton prénom et nom (vaut signature)"><input required value=${name} onInput=${(e) => setName(e.target.value)} /></${Field}>
      <p class="hint">La date, l’heure et ton compte sont enregistrés avec ton acceptation. ${!opened ? 'Ouvre d’abord le document.' : ''}</p>
    </form></${Modal}>`;
}

/** Bandeau « contrats à accepter » pour l'accueil (propriétaire) ou suivi des signatures (admin). */
export function ContractsHome() {
  const app = useApp();
  const mine = app.activeHorses.filter((h) => h.owner_id === app.me.id).map((h) => h.id);
  const [docs, reload] = useData(() => app.isAdmin ? db.select('documents', { eq: { needs_acceptance: true } }) : mine.length ? db.select('documents', { in: { horse_id: mine } }) : Promise.resolve([]), []);
  if (!docs) return null;
  const todo = docs.filter((d) => d.needs_acceptance && !d.accepted_at);
  if (app.isAdmin) {
    if (!docs.length) return null;
    return html`<div class="card"><h3>📝 Contrats</h3>
      <p><b>${docs.length - todo.length}</b> accepté${docs.length - todo.length > 1 ? 's' : ''} · <b class=${todo.length ? 'warn' : ''}>${todo.length}</b> en attente</p>
      ${todo.length > 0 && html`<div class="w-list">${todo.map((d) => html`<a class="w-chip" style="--c:#d38b1f" href=${'#cheval-' + d.horse_id}>${app.H[d.horse_id]?.name} · ${app.ownerName(app.H[d.horse_id] || {})}</a>`)}</div>`}</div>`;
  }
  if (!todo.length) return null;
  return html`<div class="card doc-home"><h3>📝 À lire et accepter</h3>${todo.map((d) => html`<div class="doc-row"><span><b>${d.title}</b><small> · ${app.H[d.horse_id]?.name}</small></span><button class="btn small primary" onClick=${() => openAccept(app, d, reload)}>Lire et accepter</button></div>`)}</div>`;
}
