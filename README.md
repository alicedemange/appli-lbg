# 🐴 Appli LBG — Écurie la Barthe Grande

L'outil de gestion de l'écurie : planning, présences, cours, animations, stages, concours, carnet de santé des chevaux, tableau sanitaire, rations, annuaire, boîte à idées, infos pratiques et registre d'élevage.

- **Hébergement** : GitHub Pages (gratuit) — aucun « build », les fichiers sont servis tels quels.
- **Données et comptes** : Supabase (gratuit).
- **Sur téléphone** : s'installe comme une appli (icône sur l'écran d'accueil).

> Sans configuration, l'appli démarre en **mode démo** (données fictives stockées dans le navigateur). Pratique pour la montrer avant de tout brancher.

---

## Les 3 espaces

| | Admin (Nathalie, Alice) | Propriétaire | DP / TP |
|---|---|---|---|
| Planning, inscriptions, présences / absences | ✅ + crée les événements | ✅ | ✅ |
| Concours : épreuve, dossard, heure de passage | ✅ pour tout le monde | ✅ pour soi | ✅ pour soi |
| Stages : groupes de passage | ✅ répartit | voit son groupe | voit son groupe |
| Fiche cheval + carnet de santé | tous les chevaux | ses chevaux | le cheval monté (peut noter un bobo) |
| Tableau sanitaire (calendrier des lots, vues par thème et par cheval), registre d'élevage | ✅ | — | — |
| Saisir / modifier les vaccins et leurs rappels | ✅ | 👁️ lecture | 👁️ lecture |
| Historique & exports Excel (planning, présences, soins, journal) | ✅ | — | — |
| Contrat de pension & documents (lire et accepter en ligne) | ✅ envoie, suit les signatures | ✅ lit, accepte, ajoute ses docs | — |
| Archiver un membre / un cheval qui quitte l'écurie | ✅ | — | — |
| Dossier PDF (fiche, carnet de santé, contrats, participations) | ✅ pour chacun | ✅ le sien | ✅ le sien |
| « Ajouter à mon agenda » (iPhone, Android, Google, Outlook) | ✅ | ✅ | ✅ |
| Proposer une balade (seul·e ou ouverte aux autres) | ✅ | ✅ | ✅ |
| Discussion de l'événement, @mentions (effacée 2 jours après) | ✅ | ✅ si inscrit | ✅ si inscrit |
| Messages privés et groupes (onglet Messages, 💬 dans l'annuaire) | ✅ | ✅ | ✅ |
| Liens photos / vidéos d'un concours (WeTransfer, Google Photos…) | ✅ | ✅ | ✅ |
| Codes d'accès, rôles, licences | ✅ | — | — |
| Annuaire, idées, infos pratiques, rations | ✅ (édite) | ✅ | ✅ |

La sécurité est assurée côté serveur (règles « RLS » dans `supabase/schema.sql`) : un propriétaire ne peut pas lire le carnet de santé d'un cheval qui n'est pas le sien, même en bricolant l'appli.

---

## Installation (≈ 20 minutes, une seule fois)

### 1. Supabase
1. Crée un compte sur [supabase.com](https://supabase.com) → **New project** (région : *West EU (Paris)* ou *Frankfurt*). Note le mot de passe de la base.
2. Menu **SQL Editor** → **New query** → colle tout le contenu de `supabase/schema.sql` → **Run**.
3. Nouvelle requête → colle le contenu de **`seed_lbg.sql`** (fichier fourni à part : il reprend les chevaux et l'historique du Google Sheet) → **Run**. Tout en bas du fichier figurent **les deux codes d'accès** de Nathalie et d'Alice.
4. **Authentication › Sign In / Providers › Email** : désactive **« Confirm email »** (plus simple pour les cavaliers ; si tu le laisses activé, l'appli gère aussi ce cas).
5. **Project Settings › API** : copie **Project URL** et la clé **anon public**.

### 2. Configuration
Ouvre `config.js` et colle les deux valeurs :
```js
SUPABASE_URL: 'https://xxxxxxxx.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOi…',
```
(La clé *anon* est faite pour être publique : ce sont les règles RLS qui protègent les données. Ne mets **jamais** la clé *service_role* ici.)

### 3. GitHub Pages
1. Sur [github.com](https://github.com) → **New repository** (ex. `appli-lbg`).
2. **Add file › Upload files** → glisse **tout le contenu** de ce dossier (index.html, config.js, css/, src/, assets/, supabase/, manifest.webmanifest, README.md). ⚠️ Pas le fichier `seed_lbg.sql`.
3. **Settings › Pages** → *Source : Deploy from a branch* → branche `main`, dossier `/ (root)` → **Save**.
4. Après 1–2 minutes, l'appli est en ligne sur `https://<ton-pseudo>.github.io/appli-lbg/`.

### 4. Dernier réglage Supabase
**Authentication › URL Configuration** : mets l'adresse GitHub Pages dans **Site URL** et dans **Redirect URLs** (sert au lien « mot de passe oublié »).

### 5. Première connexion
- Nathalie et Alice : « 🔑 Première connexion ? J'ai un code » → code du `seed_lbg.sql` → e-mail + mot de passe.
- Ensuite, dans **Membres & accès**, crée un code pour chaque propriétaire / DP / TP (en cochant ses chevaux) et envoie-lui le message tout prêt par WhatsApp ou SMS.

### 6. Installer sur le téléphone
- **iPhone** : ouvrir le lien dans Safari → bouton Partager → « Sur l'écran d'accueil ».
- **Android** : Chrome → menu ⋮ → « Installer l'application ».

---

## Sécurité de la première connexion (code PIN)
- Chaque personne reçoit un **code PIN à 6 caractères** créé par l'admin (Membres & accès › Créer un code PIN). Sans ce code, un compte reste « en attente » et ne voit **rien**.
- Le code ne sert **qu'une fois** et **expire après 30 jours**.
- Après **5 codes faux**, le compte est bloqué ; l'admin peut l'activer à la main (onglet Codes PIN › « Comptes créés sans code valide »).
- Ensuite, chacun se connecte avec son e-mail et le mot de passe qu'il a choisi (« Mot de passe oublié » disponible).

## Quand quelqu'un quitte l'écurie
- **Membres & accès › Archiver** : la personne perd l'accès, disparaît de l'annuaire et du planning, ses inscriptions futures sont retirées. Rien n'est supprimé (onglet « Anciens », réactivable).
- Avant, bouton **« Télécharger son dossier PDF »** pour le lui envoyer.
- **Fiche du cheval › Archiver** : date de sortie + destination (inscrites au registre d'élevage). Le cheval passe dans Chevaux › Archives.

## Contrats de pension
Fiche du cheval › **Contrat & documents** › Ajouter : PDF ou photo, case « le propriétaire doit le lire et l'accepter ». On peut l'envoyer à plusieurs chevaux d'un coup. Le propriétaire voit un bandeau sur son accueil ; son acceptation est horodatée (nom, date, heure, compte). Les fichiers sont dans un stockage **privé** (liens temporaires d'une heure) et invisibles pour les DP/TP.
> L'acceptation en ligne garde une trace claire et datée. Pour une valeur juridique renforcée (signature électronique certifiée), on pourra brancher plus tard un service comme Yousign.

## Balades, discussions et photos
- **Planning › 🌳 Balade** (ou depuis l'accueil) : chacun propose sa balade. Case **« Je préfère être seule »** : la balade est visible au planning (sécurité) mais personne ne peut s'inscrire. Sinon, les autres cliquent « Je viens aussi ! ».
- Chaque événement (balade, concours, stage, animation) a sa **discussion**, réservée aux inscrits. Taper **@** propose les prénoms : la personne mentionnée reçoit une invitation sur son accueil. Les messages arrivent en direct.
- La discussion **s'efface automatiquement 2 jours après l'événement** (chaque nuit si l'extension pg_cron est active, et de toute façon à chaque connexion à l'appli). Les **liens photos**, eux, restent pour toujours dans l'événement.
- ⚠️ Un lien WeTransfer gratuit expire au bout de quelques jours : pour des photos à garder, préférez un album Google Photos ou un dossier Drive partagé.
- Pour le temps réel : Supabase › Database › Publications › `supabase_realtime` doit contenir `event_messages` (le script le fait tout seul). Facultatif : Database › Extensions › activer **pg_cron** avant de lancer le script, pour le ménage nocturne.

## Messagerie
- Onglet **Messages** (pastille rouge = non lus) : toutes les discussions au même endroit — messages privés, groupes, et discussions des balades / événements.
- **💬 dans l'annuaire** (et dans le détail d'une présence au planning) pour écrire directement à quelqu'un.
- **« 👥 Groupe »** : chacun peut créer son groupe (ex. Team concours, Covoiturage), ajouter des membres, le quitter ; la personne qui l'a créé peut le renommer ou le supprimer.
- **Confidentialité** : les messages privés et de groupe ne sont lisibles que par les membres de la conversation, **pas même par l'admin**.
- **Rétention** : tous les messages sont effacés au bout de **30 jours** (et ceux des événements 2 jours après l'événement). Les groupes restent, vides, prêts à resservir.

## Mise à jour depuis la première version
Si tu avais **déjà** lancé un ancien `schema.sql` dans Supabase, lance en plus, dans l'ordre, `supabase/migration_v2.sql` (contrats, archives, code PIN) puis `supabase/migration_v3.sql` (heure des RDV soins), puis `supabase/migration_v4.sql` (balades, discussions, liens photos), puis `supabase/migration_v5.sql` (messagerie privée et groupes), puis `supabase/migration_v6.sql` (codes PIN avec téléphone, DP/TP et cours pré-remplis — nécessaire pour le `seed_lbg.sql` des vraies données), puis `supabase/migration_v7.sql` (vaccins réservés à l'admin). Pour une première installation, `schema.sql` suffit.

## Personnaliser
- **Couleurs** : en haut de `css/style.css` (variables `--navy`, `--brown`, `--sand`…).
- **Logo** : `assets/logo.png` (logo complet, écran de connexion) et `assets/monogram.png` (monogramme BG du menu). Favicon et icônes d'appli : `assets/favicon*.png`, `assets/icon-192.png`, `assets/icon-512.png`.
- **Rythmes de rappel** (vaccin 12 mois, vermifuge 4 mois, maréchal 7 semaines…) : `HEALTH_TYPES` dans `src/util.js`.

## À vérifier après l'import
- Les dates du Google Sheet ont été reprises telles quelles (vaccins 2026, maréchalerie sept.–oct. 2026, dentiste, ostéo). « Velvet (KO) » et les vaccins de fin novembre sont importés comme **RDV prévus**.
- 14 chevaux n'avaient pas de propriétaire dans l'annuaire (Doce, Ready, Lucifer…) : ils apparaissent « À renseigner » jusqu'à ce qu'on les relie (fiche du cheval › Modifier, ou via un code d'accès).
- Les numéros de téléphone n'ont **pas** été importés : chacun saisit le sien en créant son compte (RGPD-friendly). Complète les numéros des pros dans l'Annuaire.

## Bon à savoir
- Le plan gratuit de Supabase met en pause un projet resté **inactif une semaine** ; avec une utilisation quotidienne, ça n'arrive pas (et il se relance d'un clic).
- Le registre d'élevage s'exporte en CSV (Excel) et s'imprime ; les ordonnances papier restent à classer avec (5 ans).

## Structure
```
index.html            point d'entrée (charge Preact + Supabase depuis esm.sh)
config.js             URL + clé Supabase (vide = mode démo)
css/style.css         charte graphique
src/main.js           navigation, connexion, codes d'accès
src/db.js             accès aux données (Supabase ou démo)
src/pages/planning.js planning, présences, événements, concours, stages
src/pages/horses.js   chevaux, carnet de santé, tableau sanitaire, rations
src/pages/community.js accueil, annuaire, idées, infos pratiques
src/pages/admin.js    registre d'élevage, historique & exports, membres & codes, profil
supabase/schema.sql   tables + sécurité
```
