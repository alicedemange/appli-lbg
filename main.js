import { html, render, useState, useEffect, useMemo } from './lib.js';
import { db, auth, DEMO, DEMO_PIN, INIT_ERROR, initDb, purgeChats } from './db.js';
import { AppCtx, ModalHost, Toasts, Icon, Avatar, Logo, FullLogo, Badge, openModal, toast, fail, useForm, Field, Loading } from './ui.js';
import { ROLES, cls, isActive } from './util.js';
import { CONFIG } from '../config.js';
import { Planning } from './pages/planning.js';
import { Horses, HorseDetail, HealthForm, SanteBoard, Rations } from './pages/horses.js';
import { Home, Annuaire, Idees, Infos } from './pages/community.js';
import { Registre, Membres, Profil, Historique } from './pages/admin.js';
import { Messages, useUnread } from './pages/messages.js';

const NAV = [
  ['accueil', 'Accueil', 'home'],
  ['planning', 'Planning', 'calendar'],
  ['chevaux', 'Chevaux', 'horse'],
  ['chat', 'Messages', 'message'],
  ['sante', 'Tableau sanitaire', 'health', 'admin'],
  ['idees', 'Boîte à idées', 'idea'],
  ['annuaire', 'Annuaire', 'book'],
  ['infos', 'Infos pratiques', 'info'],
  ['rations', 'Rations', 'bowl'],
  ['registre', 'Registre d’élevage', 'clipboard', 'admin'],
  ['historique', 'Historique & exports', 'clock', 'admin'],
  ['membres', 'Membres & accès', 'key', 'admin'],
];
const MOBILE = ['accueil', 'planning', 'chat', 'chevaux'];

function useRoute() {
  const get = () => location.hash.replace(/^#\/?/, '') || 'accueil';
  const [r, set] = useState(get());
  useEffect(() => { const f = () => { set(get()); scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}

function App() {
  const [me, setMe] = useState(undefined);
  const [base, setBase] = useState(null);
  const route = useRoute();

  const loadMe = async () => { try { setMe(await auth.current()); } catch (e) { fail(e); setMe(null); throw e; } };
  const reloadBase = async () => {
    const [profiles, horses, riders, contacts] = await Promise.all([
      db.select('profiles', { order: 'full_name' }), db.select('horses', { order: 'name' }), db.select('horse_riders'), db.select('contacts', { order: 'name' }),
    ]);
    setBase({ profiles, horses, riders, contacts });
  };
  useEffect(() => { initDb().then(loadMe).catch((e) => { fail(e); setMe(null); }); auth.onChange((ev) => { if (ev === 'SIGNED_OUT') { setMe(null); setBase(null); } }); }, []);
  useEffect(() => { if (isActive(me)) { reloadBase().catch(fail); purgeChats().catch(() => {}); } }, [me?.id, me?.role]);

  const ctx = useMemo(() => {
    if (!me || !base) return null;
    const P = Object.fromEntries(base.profiles.map((p) => [p.id, p]));
    const H = Object.fromEntries(base.horses.map((h) => [h.id, h]));
    const isAdmin = me.role === 'admin';
    const myHorseIds = [...new Set([...base.horses.filter((h) => h.owner_id === me.id).map((h) => h.id), ...base.riders.filter((r) => r.profile_id === me.id).map((r) => r.horse_id)])];
    const c = {
      me: P[me.id] || me, ...base, P, H, isAdmin, isActive,
      members: base.profiles.filter(isActive),
      activeHorses: base.horses.filter((h) => !h.departure_date),
      riders: base.riders.filter((r) => isActive(P[r.profile_id])), myHorseIds, reloadBase, relogin: loadMe,
      ownerName: (h) => P[h.owner_id]?.full_name || h.owner_label || 'À renseigner',
      canManageHorse: (h) => isAdmin || h.owner_id === me.id,
      canSeeHealth: (h) => isAdmin || myHorseIds.includes(h.id),
      logout: async () => { await auth.signOut(); setMe(null); setBase(null); location.hash = ''; },
    };
    c.openHealth = (init, reload) => openModal((close) => html`<${AppCtx.Provider} value=${c}><${HealthForm} init=${init} close=${close} reload=${reload} /></${AppCtx.Provider}>`);
    return c;
  }, [me, base]);

  if (me === undefined) return html`<div class="boot"><${FullLogo} width=${220} /><${Loading} /></div>`;
  if (!me) return html`<${Login} onDone=${loadMe} />`;
  if (me.role === 'archive') return html`<${Archived} />`;
  if (!isActive(me)) return html`<${ClaimCode} me=${me} onDone=${loadMe} />`;
  if (!ctx) return html`<div class="boot"><${FullLogo} width=${220} /><${Loading} /></div>`;

  let page;
  const [name, ...rest] = route.split('-'); const arg = rest.join('-');
  const adminOnly = NAV.find((n) => n[0] === name)?.[3] === 'admin';
  if (adminOnly && !ctx.isAdmin) page = html`<${Home} />`;
  else switch (name) {
    case 'planning': page = html`<${Planning} />`; break;
    case 'chevaux': page = html`<${Horses} />`; break;
    case 'cheval': page = html`<${HorseDetail} id=${arg} key=${arg} />`; break;
    case 'sante': page = html`<${SanteBoard} />`; break;
    case 'idees': page = html`<${Idees} />`; break;
    case 'chat': page = html`<${Messages} arg=${arg} />`; break;
    case 'annuaire': page = html`<${Annuaire} />`; break;
    case 'infos': page = html`<${Infos} />`; break;
    case 'rations': page = html`<${Rations} />`; break;
    case 'registre': page = html`<${Registre} />`; break;
    case 'historique': page = html`<${Historique} />`; break;
    case 'membres': page = html`<${Membres} />`; break;
    case 'profil': page = html`<${Profil} />`; break;
    default: page = html`<${Home} />`;
  }
  return html`<${AppCtx.Provider} value=${ctx}><${Shell} route=${name === 'cheval' ? 'chevaux' : name}>${page}</${Shell}><${ModalHost} /></${AppCtx.Provider}>`;
}

function Shell({ route, children }) {
  const app = useAppSafe(); const { me, isAdmin } = app;
  const unread = useUnread(app);
  const [more, setMore] = useState(false);
  const items = NAV.filter((n) => !n[3] || isAdmin);
  useEffect(() => setMore(false), [route]);
  return html`<div class="shell">
    <aside class="side">
      <a class="brand" href="#accueil"><${Logo} size=${46} /><span><b>Écuries la Barthe Grande</b><small>Écurie active · Lauragais</small></span></a>
      <nav>${items.map(([k, label, ic]) => html`<a href=${'#' + k} class=${cls('nav', route === k && 'on')}><${Icon} n=${ic} /><span>${label}</span>${k === 'chat' && unread > 0 && html`<span class="nav-badge">${unread}</span>`}</a>`)}</nav>
      <a href="#profil" class=${cls('me-link', route === 'profil' && 'on')}><${Avatar} p=${me} size=${34} /><span><b>${me.full_name}</b><small>${ROLES[me.role]?.label}</small></span></a>
    </aside>
    <header class="topbar"><a class="brand" href="#accueil"><${Logo} size=${34} /><b>La Barthe Grande</b></a><a href="#profil"><${Avatar} p=${me} size=${32} /></a></header>
    ${DEMO && html`<${DemoBar} />`}
    <main class="main" key=${me.id}>${children}</main>
    <nav class="tabbar">
      ${MOBILE.map((k) => { const n = NAV.find((x) => x[0] === k); return html`<a href=${'#' + k} class=${cls(route === k && 'on')}><span class="tb-ic"><${Icon} n=${n[2]} size=${22} />${k === 'chat' && unread > 0 && html`<span class="nav-badge">${unread}</span>`}</span><span>${n[1]}</span></a>`; })}
      <button class=${cls(more && 'on')} onClick=${() => setMore(!more)}><${Icon} n="menu" size=${22} /><span>Plus</span></button>
    </nav>
    ${more && html`<div class="sheet-bg" onClick=${() => setMore(false)}><div class="sheet" onClick=${(e) => e.stopPropagation()}>
      ${items.filter((n) => !MOBILE.includes(n[0])).map(([k, label, ic]) => html`<a href=${'#' + k} class="sheet-item"><${Icon} n=${ic} /><span>${label}</span></a>`)}
      <a href="#profil" class="sheet-item"><${Icon} n="user" /><span>Mon profil</span></a></div></div>`}
  </div>`;
}
import { useApp as useAppSafe } from './ui.js';

function DemoBar() {
  const app = useAppSafe();
  const switchTo = (id) => { auth.demoLogin(id); app.relogin(); };
  const pick = [['Alice', 'Admin'], ['Chloé', 'Propriétaire'], ['Lyna', 'Tiers de pension']];
  return html`<div class="demobar"><span>🧪 <b>Mode démo</b> — données fictives. Voir l’appli en tant que :</span>
    ${pick.map(([n, l]) => { const p = app.profiles.find((x) => x.full_name === n); return p && html`<button class=${cls('chip', app.me.id === p.id && 'on')} onClick=${() => switchTo(p.id)}>${n} · ${l}</button>`; })}</div>`;
}

// ═════════════════════ CONNEXION ═════════════════════
function AuthFrame({ children }) {
  return html`<div class="auth"><div class="auth-card"><div class="auth-brand"><${FullLogo} width=${280} /><p>L’appli de l’écurie</p></div>${children}</div></div>`;
}
function Login({ onDone }) {
  const f = useForm({ name: '', pin: '' }); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const [err, setErr] = useState(INIT_ERROR || ''); const [step, setStep] = useState('');
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr(''); setStep('Connexion…');
    try { await auth.pinLogin(f.v.name, f.v.pin, setStep); setStep('C’est bon, ouverture…'); await onDone(); }
    catch (er) { console.error(er); setErr(er?.message || String(er)); }
    setBusy(false); setStep('');
  };
  const quick = (n) => { const p = auth.demoProfiles().find((x) => x.full_name === n); auth.demoLogin(p.id); onDone(); };
  return html`<${AuthFrame}>
    <form class="form" onSubmit=${go}>
      <${Field} label="Ton prénom"><input required autocomplete="username" autocapitalize="words" placeholder="Ex. Chloé" ...${f.bind('name')} /></${Field}>
      <${Field} label="Ton code PIN">
        <div class="pin-wrap"><input class="code-in" required minlength="6" maxlength="12" type=${show ? 'text' : 'password'} autocomplete="current-password" autocapitalize="characters" placeholder="••••••" ...${f.bind('pin')} />
          <button type="button" class="icon-btn" aria-label=${show ? 'Masquer le code' : 'Afficher le code'} onClick=${() => setShow(!show)}>${show ? '🙈' : '👁️'}</button></div></${Field}>
      <button class="btn primary big" disabled=${busy}>${busy ? (step || 'Connexion…') : 'Entrer'}</button>
      ${err && html`<div class="login-err" role="alert">⚠️ ${err}</div>`}
      <p class="hint center" style="margin:0">Ton prénom et ton code PIN t’ont été envoyés par l’écurie.<br />Code oublié ? Demande-en un nouveau à Nathalie.</p>
    </form>
    ${DEMO && html`<div class="demo-pick"><p class="center small muted" style="margin:14px 0 0">Mode démo : prénom de ton choix (ex. « Chloé ») + code <b>${DEMO_PIN}</b>, ou visite directement :</p>
      <button onClick=${() => quick('Alice')}><span>🔑</span><b>Espace admin</b><small>Alice — gestion complète, registre, codes PIN</small></button>
      <button onClick=${() => quick('Chloé')}><span>🐴</span><b>Espace propriétaire</b><small>Chloé — Paradino & Timy, carnet de santé</small></button>
      <button onClick=${() => quick('Lyna')}><span>🏇</span><b>Espace DP / TP</b><small>Lyna — tiers de pension de Montana</small></button></div>`}
  </${AuthFrame}>`;
}
function ClaimCode({ me, onDone }) {
  const f = useForm({ code: '', full_name: me.full_name || '', phone: me.phone || '' });
  const [busy, setBusy] = useState(false);
  const blocked = (me.claim_failures || 0) >= 5;
  const go = async (e) => { e.preventDefault(); setBusy(true); try { const r = await auth.claim(f.v.code, f.v.full_name, f.v.phone); if (r !== 'ok') toast(r, 'err'); onDone(); } catch (er) { fail(er); } setBusy(false); };
  return html`<${AuthFrame}>${blocked ? html`<div class="center"><p>🔒 Trop de codes PIN erronés.</p><p class="muted">Pour ta sécurité, ton compte est bloqué. Demande à Nathalie de l’activer depuis « Membres & accès ».</p>
      <button class="linkbtn" onClick=${async () => { await auth.signOut(); location.reload(); }}>Se déconnecter</button></div>`
    : html`<form class="form" onSubmit=${go}>
    <p class="center">Ton compte est créé 👍 Entre ton code PIN d’accès pour le relier à l’écurie.</p>
    <input class="code-in" required minlength="6" maxlength="6" autocomplete="one-time-code" placeholder="••••••" ...${f.bind('code')} />
    ${me.claim_failures > 0 && html`<p class="warn center">Code incorrect — encore ${5 - me.claim_failures} essai${5 - me.claim_failures > 1 ? 's' : ''}.</p>`}
    <${Field} label="Prénom / nom"><input required ...${f.bind('full_name')} /></${Field}>
    <${Field} label="Téléphone"><input type="tel" ...${f.bind('phone')} /></${Field}>
    <button class="btn primary big" disabled=${busy}>Valider</button>
    <button type="button" class="linkbtn" onClick=${async () => { await auth.signOut(); location.reload(); }}>Se déconnecter</button></form>`}</${AuthFrame}>`;
}
function Archived() {
  return html`<${AuthFrame}><div class="center"><p>🗄️ <b>Ton accès à l’appli a été désactivé</b>, car tu ne fais plus partie des cavaliers de l’écurie.</p>
    <p class="muted">Ton historique est conservé. Si tu souhaites récupérer ton dossier en PDF (carnet de santé de ton cheval, documents…), demande-le à Nathalie.</p>
    <p>Merci pour tous ces bons moments 🐴</p>
    <button class="btn" onClick=${async () => { await auth.signOut(); location.reload(); }}>Se déconnecter</button></div></${AuthFrame}>`;
}
function Root() { return html`<${App} /><${Toasts} />`; }
document.title = 'LBG — ' + CONFIG.NOM_ECURIE;
render(html`<${Root} />`, document.getElementById('app'));
