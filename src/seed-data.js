// Données reprises du Google Sheet (onglets ANNUAIRE, VACCINATIONS, MARECHALERIE, DENTISTE, OSTEOPATHE, NOTICES).
// Utilisées par le mode démo ET par le script qui génère supabase/seed_lbg.sql.

export const SEED_HORSES = [
  ['Anthéa', 'Marie'], ['Boston', 'Léa'], ['Chicago', 'Alice'], ['Fauve', 'Morgane'], ['Foley', 'Alice'],
  ['Hadonis', 'Cathy'], ['Haïka', 'Lucie'], ['Kalaya', 'Coralie'], ['Spring', 'Coralie'], ['Magic', 'Isabelle'],
  ['Paradino', 'Chloé'], ['Timy', 'Chloé'], ['Phénix', 'Amélie'], ['Kel Star', 'Lucile'], ['Velvet', 'Victoria'],
  ['Lexie', 'Charlène'], ['Montchauvet', 'Laurie'],
  ['Doce', ''], ['Ready', ''], ['Pessah', ''], ['Lucifer', ''], ['Gaïa', ''], ['Norma', ''], ['Galatée', ''],
  ['Uno', ''], ['No Limit', ''], ['Vastaah', ''], ['Montana', ''], ['Precioso', ''], ['Daguet', ''], ['Dakota', ''],
];

// [type, date, [chevaux], praticien, note, statut]
const V = (d, hs, note) => ['vaccin', d, hs, '', note || ''];
const M = (d, hs) => ['marechal', d, hs, 'Kevin Arzul', ''];
const D = (d, hs, who, note) => ['dentiste', d, hs, who || '', note || ''];
const O = (d, hs, note) => ['osteo', d, hs, 'Julie Carnus', note || ''];

export const SEED_HEALTH = [
  // Vaccinations 2026
  V('2026-01-28', ['Fauve']), V('2026-01-29', ['Hadonis']), V('2026-01-30', ['Anthéa']), V('2026-01-31', ['Doce']),
  V('2026-03-04', ['Foley']), V('2026-03-27', ['Lexie']), V('2026-04-10', ['Spring']), V('2026-04-27', ['Dakota']),
  V('2026-04-28', ['Montana']), V('2026-05-04', ['Phénix']), V('2026-06-04', ['Kel Star']), V('2026-07-04', ['Norma']),
  V('2026-07-05', ['Pessah'], 'Primo-vaccination : 3e injection'), V('2026-07-17', ['Gaïa', 'Galatée']),
  V('2026-07-18', ['Uno', 'No Limit']), V('2026-07-19', ['Precioso', 'Vastaah']), V('2026-07-20', ['Ready']),
  V('2026-07-21', ['Haïka', 'Timy']), V('2026-07-22', ['Boston', 'Chicago']), V('2026-09-15', ['Kalaya']),
  V('2026-09-16', ['Paradino']), V('2026-09-17', ['Norma'], 'Rhinopneumonie'), V('2026-10-04', ['Daguet'], 'Primo-vaccination : 3e injection'),
  ['vaccin', '2026-11-21', ['Lucifer'], '', '', 'prevu'],
  ['vaccin', '2026-11-26', ['Velvet'], '', 'Noté « KO » dans le Google Sheet : à vérifier', 'prevu'],
  // Maréchalerie — Kevin Arzul
  M('2026-09-02', ['Kel Star']), M('2026-09-07', ['Gaïa']), M('2026-09-14', ['Norma', 'Galatée', 'Uno']),
  M('2026-09-15', ['Vastaah', 'Montana', 'No Limit']), M('2026-09-16', ['Precioso']), M('2026-09-17', ['Anthéa', 'Haïka']),
  M('2026-09-18', ['Daguet', 'Dakota']), M('2026-10-26', ['Doce', 'Ready', 'Pessah']), M('2026-10-27', ['Lucifer', 'Foley', 'Kalaya']),
  M('2026-10-28', ['Timy', 'Spring']), M('2026-10-29', ['Gaïa']), M('2026-10-30', ['Chicago', 'Paradino', 'Fauve']),
  M('2026-10-31', ['Phénix', 'Boston', 'Velvet']),
  // Dentiste
  D('2024-03-12', ['Galatée']), D('2024-05-14', ['Spring'], '', '2 ans'),
  D('2025-09-09', ['No Limit'], 'Isa'), D('2025-09-29', ['Chicago'], 'Isa'), D('2025-09-30', ['Boston'], 'Isa'),
  D('2025-10-21', ['Doce'], 'Mo'), D('2025-10-22', ['Montana'], 'Mo'), D('2025-10-23', ['Vastaah'], 'Mo'), D('2025-10-24', ['Precioso'], 'Mo'),
  D('2025-10-25', ['Timy'], 'Mo'), D('2025-10-26', ['Kel Star'], 'Ma'), D('2025-10-27', ['Haïka'], 'Ma'), D('2025-10-28', ['Phénix'], 'Ma'),
  D('2025-10-29', ['Foley'], 'Ma'), D('2025-10-30', ['Velvet'], 'Ma'), D('2025-10-31', ['Paradino'], 'Ma'),
  D('2025-12-02', ['Gaïa'], 'Mo'), D('2025-12-03', ['Lucifer'], 'Ma'), D('2025-12-04', ['Ready'], 'Ma'), D('2025-12-05', ['Anthéa'], 'Mo'),
  D('2025-12-06', ['Fauve'], 'Ma'), D('2026-04-16', ['Uno']), D('2026-04-17', ['Kalaya']), D('2026-04-18', ['Hadonis']),
  // Ostéopathe — Julie Carnus
  O('2022-08-25', ['Galatée']), O('2023-02-13', ['Spring']), O('2023-04-17', ['Precioso']), O('2023-10-30', ['Fauve']),
  O('2024-01-10', ['Vastaah', 'Montana']), O('2024-05-06', ['Anthéa', 'Magic']), O('2024-12-10', ['Uno']), O('2025-01-08', ['No Limit']),
  O('2025-03-05', ['Foley']), O('2025-03-06', ['Phénix']), O('2025-03-26', ['Lucifer']), O('2025-10-08', ['Kel Star']), O('2025-10-09', ['Ready']),
  O('2026-01-08', ['Doce', 'Gaïa']), O('2026-04-20', ['Dakota']), O('2026-04-21', ['Daguet']), O('2026-04-22', ['Paradino']),
  O('2026-08-23', ['Kalaya']), O('2026-08-24', ['Haïka']), O('2026-08-25', ['Hadonis']), O('2026-08-26', ['Paradino'], 'Cervicales seules'),
  O('2026-08-27', ['Boston']), O('2026-08-28', ['Chicago']),
];

export const SEED_CONTACTS = [
  ['Nathalie', 'ecurie', '06 33 07 90 81', 'Gérante — numéro de l’écurie'],
  ['Kevin Arzul', 'marechal', '', 'Maréchal-ferrant'],
  ['Julie Carnus', 'osteo', '', 'Ostéopathe équin'],
  ['Isabelle', 'veterinaire', '', 'Vétérinaire (aussi dentisterie)'],
  ['Morgane', 'veterinaire', '', 'Vétérinaire (aussi dentisterie)'],
  ['Emma', 'veterinaire', '', 'Vétérinaire'],
];

export const SEED_NOTICES = [
  ['Arrosage du manège', `1. Si nécessaire : ouvrir la vanne bleue (dans le manège, sur le mur).
2. Lancer un cycle en appuyant sur CYC.
3. Attendre… les arroseurs se déclenchent un par un, du stockage vers le parking.
4. Quand c'est fini, et si elle était fermée au début : refermer la vanne bleue.`],
  ['Recharge de la brouette électrique', `⚠️ En journée uniquement, pas la nuit (au cas où…)
1. Mettre le coupe-circuit sur OFF ou sur OUT.
2. Enlever la clé.
3. Brancher le chargeur à la brouette et à la prise avec la rallonge, à l'abri de la pluie et de l'arrosage du manège.
4. Poser le chargeur sur la brouette et non pas par terre.
Veiller à toujours débrancher de la prise murale.`],
];
