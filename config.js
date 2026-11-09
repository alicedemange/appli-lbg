// ─────────────────────────────────────────────────────────────
//  Configuration de l'appli LBG
//  URL du projet Supabase (sans /rest/v1/) et clé « publishable »
//  (Supabase › Project Settings › API Keys). Jamais la clé « secret » !
//  Si les deux champs restent vides, l'appli démarre en MODE DÉMO
//  (données fictives enregistrées seulement dans ton navigateur).
// ─────────────────────────────────────────────────────────────
export const CONFIG = {
  SUPABASE_URL: 'https://xbqvohwtjkpfrlczktfl.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_kfXWjYNejuk1r3yB6EEb6Q_AyHrNJF6', // clé « publishable » (publique, sans danger)
  NOM_ECURIE: 'Écurie la Barthe Grande',
  // Domaine technique des comptes (personne ne reçoit d’e-mail : connexion par prénom + code PIN)
  LOGIN_DOMAIN: 'membres.ecurie-active-lbg.fr',
};
