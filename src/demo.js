// Jeu de données fictif pour le mode démo (inspiré du planning réel de novembre).
import { SEED_HORSES, SEED_HEALTH, SEED_CONTACTS, SEED_NOTICES } from './seed-data.js';
import { todayISO, weekStart, addDays } from './util.js';
import { DEMO_CONTRACT } from './demo-contract.js';

export function buildDemoData() {
  let n = 0; const id = (p) => `${p}-${++n}`;
  const now = new Date().toISOString();
  const W0 = weekStart(todayISO()); const day = (w, d) => addDays(W0, w * 7 + d); // d : 0 = lundi

  const people = [
    ['Nathalie', 'admin'], ['Alice', 'admin'],
    ['Marie', 'proprietaire'], ['Léa', 'proprietaire'], ['Morgane', 'proprietaire'], ['Cathy', 'proprietaire'], ['Lucie', 'proprietaire'],
    ['Coralie', 'proprietaire'], ['Isabelle', 'proprietaire'], ['Chloé', 'proprietaire'], ['Amélie', 'proprietaire'], ['Lucile', 'proprietaire'],
    ['Victoria', 'proprietaire'], ['Charlène', 'proprietaire'], ['Laurie', 'proprietaire'],
    ['Lyna', 'dp'], ['Olwen', 'dp'], ['Marine', 'dp'], ['Emma', 'dp'], ['Alison', 'dp'], ['Alice S', 'dp'], ['Lu', 'dp'], ['Jeanne', 'dp'],
    ['Gégé', 'archive'], ['Camille', 'nouveau'],
  ];
  const profiles = people.map(([full_name, role], i) => ({
    id: id('p'), full_name, role, login: full_name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.'), login_label: full_name, phone: `06 00 00 ${String(10 + i).padStart(2, '0')} ${String(20 + i).padStart(2, '0')}`,
    email: '', claim_failures: full_name === 'Camille' ? 2 : 0, archived_at: role === 'archive' ? addDays(todayISO(), -45) + 'T10:00:00Z' : null, licence_ffe: role !== 'admin' && i % 3 ? `${1234500 + i}A` : '', licence_year: i % 4 ? 2027 : 2026, color: null, created_at: now,
  }));
  const P = Object.fromEntries(profiles.map((p) => [p.full_name, p.id]));

  const pension = ['base', 'plus', 'max'];
  const horses = SEED_HORSES.map(([name, owner], i) => ({
    id: id('h'), name, owner_id: owner ? P[owner] : (name === 'Ready' || name === 'Doce' ? P.Nathalie : null), owner_label: owner || '',
    sex: ['jument', 'hongre', 'hongre', 'jument', 'entier'][i % 5 === 4 ? 1 : i % 4], birth_date: `${2008 + (i * 7) % 15}-0${1 + (i % 9)}-1${i % 9}`,
    breed: ['Selle Français', 'Pur-sang arabe', 'Connemara', 'PRE', 'Haflinger', 'Trotteur Français', 'Quarter Horse'][i % 7],
    robe: ['Bai', 'Alezan', 'Gris', 'Bai brun', 'Noir', 'Palomino'][i % 6], height: 150 + (i * 3) % 25,
    sire: '', ueln: `25000${(1000000 + i * 4231).toString().slice(0, 7)}X`, transponder: `250259${(700000000 + i * 1234567).toString()}`,
    pension: pension[i % 3], arrival_date: `${2019 + (i % 7)}-0${1 + (i % 8)}-01`, origin: i % 2 ? 'Élevage (Aude)' : 'Écurie (Haute-Garonne)',
    departure_date: name === 'Magic' ? addDays(todayISO(), -38) : null, destination: name === 'Magic' ? 'Retraite au pré (Ariège)' : '', photo: null,
    ration_morning: ['1 mesure floconnés', '2 mesures granulés', '½ mesure luzerne', ''][i % 4],
    ration_evening: ['1 mesure floconnés', '2 mesures granulés + huile', '1 mesure luzerne', ''][i % 4],
    supplements: i % 5 === 0 ? 'Complément articulations' : '', notes: '', created_at: now,
  }));
  const H = Object.fromEntries(horses.map((h) => [h.name, h.id]));
  const riders = [
    ['Montana', 'Lyna', 'TP'], ['Montana', 'Alison', 'TP'], ['Vastaah', 'Olwen', 'TP'], ['Vastaah', 'Morgane', 'TP'],
    ['Doce', 'Marine', 'TP'], ['Boston', 'Emma', 'TP'], ['Paradino', 'Jeanne', 'DP'], ['Kel Star', 'Lu', 'DP'],
  ].map(([h, p, kind]) => ({ id: id('r'), horse_id: H[h], profile_id: P[p], kind, days: '' }));

  const health = [];
  for (const [type, date, hs, practitioner, notes, status] of SEED_HEALTH)
    for (const h of hs) health.push({ id: id('s'), horse_id: H[h], type, date, status: status || 'fait', practitioner, product: '', lot: '', notes, next_due: null, created_by: null, created_at: now });
  // quelques vermifuges / bobos / RDV prévus pour la démo
  ['Chicago', 'Foley', 'Boston', 'Paradino', 'Montana', 'Doce', 'Haïka', 'Kalaya'].forEach((h, i) =>
    health.push({ id: id('s'), horse_id: H[h], type: 'vermifuge', date: addDays(todayISO(), -40 - i * 12), status: 'fait', practitioner: '', product: ['Equest Pramox', 'Eqvalan Duo', 'Strongid'][i % 3], lot: `L${2604 + i}`, notes: i === 2 ? 'Après coproscopie' : '', next_due: null, created_by: null, created_at: now }));
  health.push({ id: id('s'), horse_id: H.Paradino, type: 'veto', date: day(0, 3), time: '10:30', status: 'prevu', practitioner: 'Isabelle', product: '', lot: '', notes: 'Contrôle boiterie + échographie tendon', next_due: null, created_by: P.Nathalie, created_at: now });
  health.push({ id: id('s'), horse_id: H.Chicago, type: 'bobo', date: addDays(todayISO(), -9), status: 'fait', practitioner: '', product: 'Bétadine + pansement', lot: '', notes: 'Petite coupure antérieur gauche (barbelé au pré). Surveiller 3 jours.', next_due: null, created_by: P.Alice, created_at: now });
  health.push({ id: id('s'), horse_id: H.Foley, type: 'veto', date: addDays(todayISO(), -63), status: 'fait', practitioner: 'Isabelle', product: 'Anti-inflammatoire 5 j', lot: '', notes: 'Boiterie légère postérieur droit — repos 1 semaine, reprise au pas.', next_due: null, created_by: P.Alice, created_at: now });
  ['Norma', 'Galatée', 'Uno'].forEach((h) => health.push({ id: id('s'), horse_id: H[h], type: 'marechal', date: day(1, 1), time: '09:00', status: 'prevu', practitioner: 'Kevin Arzul', product: '', lot: '', notes: '', next_due: null, created_by: P.Nathalie, created_at: now }));
  ['Vastaah', 'Montana', 'No Limit'].forEach((h) => health.push({ id: id('s'), horse_id: H[h], type: 'marechal', date: day(1, 2), time: '14:00', status: 'prevu', practitioner: 'Kevin Arzul', product: '', lot: '', notes: '', next_due: null, created_by: P.Nathalie, created_at: now }));

  // ── Planning ──
  const events = []; const parts = [];
  const ev = (o, people = []) => {
    const e = { id: id('e'), location: '', description: '', capacity: null, series_id: null, created_by: P.Nathalie, created_at: now, end_time: null, ...o };
    events.push(e);
    people.forEach((x) => { const [name, extra] = Array.isArray(x) ? x : [x, {}]; parts.push({ id: id('ep'), event_id: e.id, profile_id: P[name], horse_id: null, status: 'inscrit', bring: '', group_label: '', slot_time: null, class_name: '', bib: '', class_time: null, result: '', note: '', ...extra }); });
    return e;
  };
  for (const w of [-1, 0, 1, 2]) {
    const s1 = `serie-mar-${w}`, s2 = `serie-jeu-${w}`;
    ev({ type: 'cours', title: 'Cours collectif', date: day(w, 1), start_time: '18:45', end_time: '19:45', location: 'Carrière', series_id: 'serie-mardi', capacity: 6 }, [['Lucie', w === 0 ? { status: 'absent' } : {}], 'Morgane', 'Charlène', 'Alison']);
    ev({ type: 'cours', title: 'Cours collectif', date: day(w, 3), start_time: '18:45', end_time: '19:45', location: 'Manège', series_id: 'serie-jeudi', capacity: 6 }, ['Coralie', 'Cathy', 'Emma']);
    ev({ type: 'cours', title: 'Cours collectif', date: day(w, 5), start_time: '09:00', end_time: '10:00', location: 'Carrière', series_id: 'serie-sam9', capacity: 6 }, ['Amélie', 'Alice S', 'Olwen']);
    ev({ type: 'cours', title: 'Cours collectif', date: day(w, 5), start_time: '11:00', end_time: '12:00', location: 'Carrière', series_id: 'serie-sam11', capacity: 6 }, ['Lyna', 'Alice', 'Chloé']);
    void s1; void s2;
  }
  ev({ type: 'animation', title: 'Raclette party 🧀', date: day(0, 5), start_time: '12:00', location: 'Club-house', description: "On partage une raclette après le cours ! Indiquez ce que vous apportez pour éviter d'avoir 4 kg de fromage et pas de patates 😄\nOn a du vin dans notre réserve !", capacity: null }, [
    ['Laurie', { bring: 'Charcuterie, fromage, champignons (+ 1 appareil) — on sera 4', note: '' }], ['Alice S', { bring: 'Fromage et jambon (avec Lu)' }], ['Lu', { bring: 'Fromage et jambon (avec Alice S)' }],
    ['Emma', { bring: 'Pommes de terre et boissons (à confirmer) + 1 appareil' }], ['Chloé', { bring: 'Bières, œufs durs, tomates, cornichons, jambon blanc' }],
    ['Olwen', { bring: 'Dessert + 1 appareil à raclette' }], ['Jeanne', { bring: 'Cookies' }], ['Alison', { bring: 'Apéro (chips, saucisson) + softs' }],
    ['Alice', { bring: 'Pas sûre d’avoir le temps (je récupère David) — appareil 4 pers. si besoin' }],
  ]);
  ev({ type: 'stage', title: 'Stage dressage / saut avec Olivier', date: day(0, 6), start_time: '08:30', end_time: '12:30', location: 'Manège', description: 'Stage DR/SO. Nathalie répartit les groupes de passage la veille.', capacity: 10 }, [
    ['Chloé', { group_label: 'Groupe 1', slot_time: '09:00', horse_id: H.Paradino }], ['Lyna', { group_label: 'Groupe 1', slot_time: '09:00', horse_id: H.Montana }],
    ['Alice', { group_label: 'Groupe 2', slot_time: '10:00', horse_id: H.Doce }], ['Nathalie', { group_label: 'Groupe 2', slot_time: '10:00', horse_id: H.Ready }],
    ['Coralie', { status: 'absent', note: 'Annulé' }], ['Emma', {}],
  ]);
  ev({ type: 'concours', title: 'CSO La Millassolle', date: day(1, 6), start_time: '08:00', location: 'La Millassolle', description: 'Épreuves Club & Amateur. Départ du camion 7h00 — penser aux carnets de vaccination !\nAlice en groom / coach mentale 🥹', capacity: null }, [
    ['Nathalie', { horse_id: H.Ready, class_name: 'Ama 3 — 105 cm', bib: '112', class_time: '09:15' }],
    ['Alice', { horse_id: H.Doce, class_name: 'Club 1 — 95 cm', bib: '87', class_time: '10:40' }],
    ['Olwen', { horse_id: H.Vastaah, class_name: 'Club 2 — 85 cm', bib: '54', class_time: '11:30' }],
    ['Chloé', { horse_id: H.Paradino, class_name: 'Club 1 — 95 cm', bib: '', class_time: null, note: 'Engagement en attente' }],
    ['Lyna', { horse_id: H.Montana, class_name: 'Club 3 — 75 cm', bib: '23', class_time: '13:05' }],
  ]);
  const bal = ev({ type: 'sortie', title: 'Balade dans les collines 🌳', date: day(0, 4), start_time: '14:00', end_time: '16:00', location: 'Chemin des crêtes', description: 'Tranquille au pas et au trot, environ 1 h 30. Chevaux calmes en extérieur 🙂', capacity: 5, open: true, created_by: P['Chloé'] },
    [['Chloé', { horse_id: H.Paradino }], ['Lyna', { horse_id: H.Montana }], ['Emma', { horse_id: H.Boston }]]);
  ev({ type: 'sortie', title: 'Petit tour au pas', date: day(0, 2), start_time: '10:30', end_time: '11:30', location: 'Bois de la Barthe', description: '', open: false, created_by: P.Lucie }, [['Lucie', { horse_id: H['Haïka'] }]]);
  const cso0 = ev({ type: 'concours', title: 'CSO Montesquieu-Lauragais', date: day(-1, 6), start_time: '08:00', location: 'Montesquieu', description: 'Club & Amateur', capacity: null },
    [['Alice', { horse_id: H.Doce, class_name: 'Club 1', bib: '64', class_time: '10:10', result: '3e 🥉' }], ['Chloé', { horse_id: H.Paradino, class_name: 'Club 2', bib: '71', class_time: '11:25', result: 'sans faute' }], ['Nathalie', { horse_id: H.Ready, class_name: 'Ama 3', bib: '105', class_time: '13:40', result: '1re 🏆' }]]);
  ev({ type: 'sortie', title: 'Balade au lac de la Ganguise', date: day(2, 6), start_time: '10:00', end_time: '13:00', location: 'Départ écurie', description: 'Balade tranquille au pas/trot, pique-nique tiré du sac.', capacity: 8 }, ['Lyna', 'Marine', 'Coralie']);

  const t0 = (d, h) => `${d}T${h}:00.000Z`;
  const event_messages = [
    { id: id('m'), event_id: bal.id, author_id: P['Chloé'], body: 'Hello ! Je pars vendredi 14h, qui vient ? On fait la boucle des crêtes 🌳 @Marine ça te dit avec Doce ?', mentions: [P.Marine], created_at: t0(day(0, 0), '09:12') },
    { id: id('m'), event_id: bal.id, author_id: P.Lyna, body: 'Carrément, je viens avec Montana ! On se retrouve 13h30 au pansage ?', mentions: [], created_at: t0(day(0, 0), '10:40') },
    { id: id('m'), event_id: bal.id, author_id: P.Emma, body: 'Je suis partante aussi 🙋 Boston est un peu speed en extérieur, je me mets derrière.', mentions: [], created_at: t0(day(0, 0), '12:05') },
    { id: id('m'), event_id: bal.id, author_id: P['Chloé'], body: 'Parfait ! 13h30 au pansage. Pensez aux gilets fluo 🦺', mentions: [], created_at: t0(day(0, 0), '12:20') },
  ];
  const event_links = [
    { id: id('l'), event_id: cso0.id, author_id: P.Nathalie, url: 'https://we.tl/t-EXEMPLE-demo', label: 'Photos du photographe officiel', created_at: t0(day(0, 0), '08:30') },
    { id: id('l'), event_id: cso0.id, author_id: P['Chloé'], url: 'https://photos.app.goo.gl/EXEMPLE', label: 'Vidéos des parcours (Google Photos)', created_at: t0(day(0, 0), '11:00') },
  ];
  // Conversations privées et groupes
  const conversations = [], conversation_members = [], messages = [];
  const conv = (kind, title, by, members, msgs) => {
    const c = { id: crypto.randomUUID ? crypto.randomUUID() : id('cv'), kind, title, created_by: P[by], created_at: t0(day(-1, 2), '08:00') };
    conversations.push(c);
    members.forEach((m) => conversation_members.push({ id: id('cm'), conversation_id: c.id, profile_id: P[m], last_read_at: m === by ? t0(day(0, 0), '23:00') : null }));
    msgs.forEach(([who, body, d, h]) => messages.push({ id: id('ms'), conversation_id: c.id, author_id: P[who], body, mentions: [], created_at: t0(d, h) }));
  };
  conv('direct', '', 'Chloé', ['Chloé', 'Lyna'], [
    ['Chloé', 'Coucou Lyna ! Tu pourrais jeter un œil à Paradino jeudi soir ? Je ne serai pas là 🙏', day(0, 0), '08:05'],
    ['Lyna', 'Oui pas de souci, je passe vers 18h. Je lui mets sa couverture ?', day(0, 0), '08:20'],
    ['Chloé', 'Oui si < 8°C. Merci mille fois !! ❤️', day(0, 0), '08:22'],
  ]);
  conv('group', 'Team concours 🏆', 'Alice', ['Alice', 'Nathalie', 'Chloé', 'Olwen', 'Lyna'], [
    ['Alice', 'Bienvenue dans le groupe concours ! On s’organise ici pour les engagements et le camion 🚛', day(-1, 2), '09:00'],
    ['Nathalie', 'Engagements La Millassolle à faire avant mercredi soir svp.', day(0, 0), '11:30'],
    ['Olwen', 'C’est fait pour Vastaah, Club 2 👍', day(0, 0), '12:10'],
  ]);
  conv('group', 'Covoiturage', 'Marine', ['Marine', 'Emma', 'Lyna', 'Lu'], [
    ['Marine', 'Je descends de Toulouse samedi matin, 2 places dans la voiture si besoin 🚗', day(0, 0), '07:45'],
  ]);
  const pres = []; const pr = (w, d, name, time, kind = 'monte', note = '', horse = null) =>
    pres.push({ id: id('pr'), profile_id: P[name], horse_id: horse ? H[horse] : null, date: day(w, d), time, kind, note, created_at: now });
  [0, 1, 2, 3, 4, 5].forEach((d) => pr(0, d, 'Cathy', null, 'absent'));
  pr(0, 0, 'Marine', '10:15', 'monte', '', 'Doce'); pr(0, 0, 'Coralie', '18:30', 'monte', '', 'Kalaya');
  pr(0, 2, 'Chloé', '12:00', 'monte', '', 'Paradino'); pr(0, 2, 'Alice', '18:30', 'monte', '', 'Chicago'); pr(0, 2, 'Lu', '18:45', 'monte', '', 'Kel Star');
  pr(0, 3, 'Lyna', '09:00', 'monte', '', 'Montana'); pr(0, 3, 'Marine', '14:15', 'monte', '', 'Doce'); pr(0, 3, 'Chloé', '18:00', 'monte', '', 'Timy'); pr(0, 3, 'Alison', '19:30', 'monte', '', 'Montana');
  pr(0, 4, 'Lu', '10:00', 'monte', '', 'Kel Star'); pr(0, 4, 'Chloé', '12:00', 'monte', '', 'Paradino');
  pr(0, 5, 'Lu', null, 'absent'); pr(0, 5, 'Coralie', null, 'absent');
  pr(0, 6, 'Emma', '10:00', 'monte', '', 'Boston'); pr(0, 6, 'Morgane', '10:00', 'monte', '', 'Vastaah'); pr(0, 6, 'Coralie', '14:00', 'monte', '', 'Spring'); pr(0, 6, 'Lu', null, 'absent');
  pr(1, 0, 'Lu', '18:00', 'passage', 'Juste un passage'); pr(1, 0, 'Coralie', '18:30', 'monte', '', 'Kalaya');
  pr(1, 1, 'Lyna', '15:00', 'soin', 'Douche Montana ?', 'Montana'); pr(1, 2, 'Lu', '10:00', 'monte', '', 'Kel Star'); pr(1, 2, 'Lyna', '10:00', 'soin', 'Tonte de Montana', 'Montana');
  pr(1, 2, 'Chloé', '18:00', 'monte', '', 'Paradino'); pr(1, 4, 'Morgane', '11:00', 'monte', '', 'Vastaah'); pr(1, 4, 'Chloé', '12:00', 'monte', '', 'Timy');
  [3, 4, 5, 6].forEach((d) => pr(1, d, 'Lu', null, 'absent'));

  const suggestions = [
    { title: 'Balade au lac de la Ganguise', category: 'sortie', author_id: P.Lyna, status: 'validee', description: "Une matinée balade tous ensemble jusqu'au lac, avec pique-nique ? Pour les chevaux calmes en extérieur.", event_id: events[events.length - 1].id },
    { title: 'Soirée galette des rois 👑', category: 'animation', author_id: P['Chloé'], status: 'nouvelle', description: 'Début janvier, après le cours du jeudi. Chacun ramène une galette ou du cidre.' },
    { title: 'Stage travail à pied / éthologie', category: 'stage', author_id: P.Emma, status: 'etudiee', description: "Une journée pour apprendre les bases du travail à pied et de la liberté — super pour les jeunes chevaux et l'hiver." },
    { title: 'Un tableau pour ranger les couvertures', category: 'materiel', author_id: P.Marine, status: 'nouvelle', description: 'Avec le nom de chaque cheval, pour ne plus mélanger les couvertures quand il pleut.' },
    { title: 'Concours photo de nos chevaux 📸', category: 'animation', author_id: P.Olwen, status: 'nouvelle', description: 'Vote pour la plus belle photo du mois, affichée au club-house et sur Insta.' },
  ].map((s, i) => ({ id: id('i'), created_at: new Date(Date.now() - i * 86400000 * 3).toISOString(), event_id: null, ...s }));
  const votes = [];
  const voters = Object.values(P);
  suggestions.forEach((s, i) => voters.slice(0, [9, 7, 5, 3, 6][i]).forEach((pid, k) => votes.push({ id: id('v'), suggestion_id: s.id, profile_id: voters[(k * 3 + i) % voters.length] })));

  const posts = [
    { id: id('a'), kind: 'annonce', title: 'Merci pour la raclette ! 🧀', body: 'Super moment ce midi, merci à toutes et tous. Pensez à récupérer vos appareils au club-house.', pinned: true, author_id: P.Nathalie, created_at: now },
    { id: id('a'), kind: 'annonce', title: 'CSO La Millassolle — dimanche prochain', body: 'Ajoutez votre dossard, épreuve et heure de passage dans l’événement dès que vous les avez. Départ du camion 7h.', pinned: false, author_id: P.Nathalie, created_at: new Date(Date.now() - 86400000).toISOString() },
    ...SEED_NOTICES.map(([title, body]) => ({ id: id('a'), kind: 'notice', title, body, pinned: false, author_id: P.Nathalie, created_at: now })),
  ];
  const contacts = SEED_CONTACTS.map(([name, category, phone, note], i) => ({ id: id('c'), name, category, phone: phone || `06 00 00 9${i} 0${i}`, email: '', note }));
  const settings = [{ id: 'registre', data: { holder_name: 'Écurie la Barthe Grande — Nathalie', holder_number: '', address: 'La Grande Barthe, 11410 Belflou', activity: 'Pension en écurie active', vet_name: '', vet_phone: '', opened_on: '' } }];

  const documents = [
    { id: id('d'), horse_id: H.Paradino, kind: 'contrat', title: 'Contrat de pension 2027 — formule Plus', file_path: DEMO_CONTRACT, file_name: 'contrat-paradino-2027.pdf', needs_acceptance: true, accepted_at: null, accepted_by: null, accepted_name: null, created_by: P.Nathalie, created_at: addDays(todayISO(), -2) + 'T09:00:00Z' },
    { id: id('d'), horse_id: H.Timy, kind: 'reglement', title: 'Règlement intérieur 2027', file_path: DEMO_CONTRACT, file_name: 'reglement-interieur.pdf', needs_acceptance: true, accepted_at: addDays(todayISO(), -1) + 'T18:12:00Z', accepted_by: P['Chloé'], accepted_name: 'Chloé', created_by: P.Nathalie, created_at: addDays(todayISO(), -2) + 'T09:00:00Z' },
    { id: id('d'), horse_id: H.Chicago, kind: 'contrat', title: 'Contrat de pension 2027 — formule Max', file_path: DEMO_CONTRACT, file_name: 'contrat-chicago-2027.pdf', needs_acceptance: true, accepted_at: addDays(todayISO(), -1) + 'T20:40:00Z', accepted_by: P.Alice, accepted_name: 'Alice', created_by: P.Nathalie, created_at: addDays(todayISO(), -2) + 'T09:00:00Z' },
    { id: id('d'), horse_id: H.Boston, kind: 'contrat', title: 'Contrat de pension 2027 — formule de base', file_path: DEMO_CONTRACT, file_name: 'contrat-boston-2027.pdf', needs_acceptance: true, accepted_at: null, accepted_by: null, accepted_name: null, created_by: P.Nathalie, created_at: addDays(todayISO(), -2) + 'T09:00:00Z' },
  ];
  const oldParts = [];
  return { conversations, conversation_members, messages, event_messages, event_links, chat_reads: [], documents, profiles, horses, horse_riders: riders, health_events: health, events, event_participants: parts, presences: pres, suggestions, suggestion_votes: votes, posts, contacts, settings, invitations: [] };
}
