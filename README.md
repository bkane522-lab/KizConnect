# KizConnect V3.2.2 — Mobile First Compact UX

> Cette version conserve le backend, Supabase, la sécurité et les fonctionnalités validées de la V3.2.1. La modification principale est l’accueil mobile : moins de décoration au-dessus de la ligne de flottaison et accès immédiat aux trois actions essentielles.

### Changement UX principal

Sur téléphone, l’écran d’accueil affiche maintenant en priorité :

1. **Trouvez avec qui danser.**
2. **Trouver un partenaire**
3. **Covoiturage**
4. **Mes messages**

Le visuel cristal reste présent dans le header et l’identité générale, mais le grand visuel décoratif du hero est masqué sur mobile pour éviter le scroll avant l’action.


**KizConnect — Trouvez avec qui danser.**

Parcours principal : **Ouvrir → Choisir → Rechercher → Contacter.**

## Ce que contient la V3.2.2

- accueil limité à 3 actions principales ;
- navigation sans swipe ni geste caché ;
- découverte sans compte obligatoire ;
- inscription / connexion Supabase Auth seulement au moment nécessaire ;
- reprise automatique de l'action après connexion (contacter, publier, messages) ;
- profil danseur : pseudo, ville, niveau, styles, bio, photo facultative ;
- recherche partenaire : ville + style + niveau ;
- demandes de training : publier, consulter, supprimer ;
- covoiturage : rechercher une offre et proposer des places ;
- aucune adresse précise rendue publique ;
- messagerie privée 1-à-1 avec nouveaux messages en temps réel ;
- masquer une conversation ;
- bloquer / débloquer ;
- signaler avec motif ;
- page « Mes annonces » ;
- PWA avec manifest + service worker ;
- Row Level Security sur toutes les tables sensibles ;
- garde anti-spam de base : annonces et messages ;
- stockage Supabase sécurisé pour les avatars ;
- aucun email public dans `profiles` ;
- aucune clé `service_role` dans le frontend.

## 1. Installation locale

```bash
npm install
cp .env.example .env
npm run dev
```

Sans variables Supabase, l'interface fonctionne en **mode aperçu**, mais les données et comptes réels restent désactivés.

## 2. Configurer Supabase

Créer un projet Supabase neuf puis exécuter dans **SQL Editor** :

`supabase/migrations/001_kizconnect_v3.sql`

Ensuite renseigner `.env` :

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

Utiliser uniquement la clé publique prévue pour le client. Ne jamais intégrer de clé administrative dans le frontend.

## 3. Authentification

Dans Supabase > Authentication :

- Email/Password doit être activé ;
- pour la bêta actuelle, la confirmation email peut rester désactivée afin de garder une inscription directe ;
- ajouter l'URL locale et l'URL de production dans les Redirect URLs.

Le trigger SQL crée automatiquement le profil public lors de l'inscription.

## 4. Tests

```bash
npm run check
npm run build
```

Le contrôle statique vérifie notamment la présence des protections RLS, des RPC sécurisées, du module temps réel et l'absence de l'ancien backend Upstash.

Pour valider la sécurité réelle avec un projet Supabase, suivre :

`docs/TEST_PLAN.md`

## 5. Déploiement

Le frontend est un projet Vite statique. Après :

```bash
npm run build
```

le dossier `dist/` peut être déployé sur Vercel ou un hébergeur statique compatible PWA.

## Ce qui n'est volontairement pas dans la V3.2.2

- followers ;
- likes ;
- stories ;
- groupes ;
- classement des danseurs ;
- marketplace de billets ;
- GPS permanent ;
- système de paiement ;
- réseau social complexe.

La V3.2 reste une bêta : avant publication publique, les tests multi-comptes du plan de test doivent être réalisés sur le vrai projet Supabase.

## V3.1 — Crystal UI

La V3.1 conserve le backend, l'authentification, les profils, la recherche, les trainings, le covoiturage, la messagerie, le blocage et les signalements validés en V3.

Refonte visuelle :
- nouveau logo KIZ CONNECT cristal ;
- thème sombre violet / magenta avec accents orange ;
- cartes glassmorphism lisibles ;
- boutons et formulaires modernisés ;
- nouveau branding sur l'accueil et l'en-tête ;
- nouvelles icônes PWA dérivées du logo ;
- aucune nouvelle navigation cachée ni swipe obligatoire.

La migration Supabase reste `supabase/migrations/001_kizconnect_v3.sql` : si la V3 est déjà installée et fonctionnelle, ne la réexécute pas uniquement pour passer à la V3.1.


## V3.1.1 — Accueil plus attirant

Cette version conserve toutes les fonctions V3/V3.1 déjà validées et retravaille uniquement l'expérience d'accueil :

- hero plus vivant et plus compact ;
- logo cristal mis en scène sans surcharger l'écran ;
- bouton **COMMENCER** qui descend vers les 3 actions principales ;
- pictogrammes explicites pour partenaire, covoiturage et messages ;
- meilleure hiérarchie visuelle et contraste ;
- rappel **Simple · Direct · Sans swipe** ;
- responsive renforcé pour téléphone ;
- aucun changement de schéma Supabase.

Si votre V3 fonctionne déjà, **ne réexécutez pas la migration SQL** pour passer à la V3.1.1.

## V3.2 — Crystal Polish

La V3.2 conserve intégralement la base fonctionnelle déjà validée et ajoute une passe de finition globale :

- cohérence visuelle renforcée sur tous les écrans ;
- surfaces cristal plus lisibles et moins agressives ;
- accueil plus compact sur mobile pour voir les actions principales plus vite ;
- focus des formulaires plus évident ;
- cartes profil, états vides et messagerie harmonisés ;
- zones tactiles et contraste affinés ;
- support `prefers-reduced-motion` ;
- métadonnées PWA/iOS complétées ;
- aucun changement de schéma Supabase.

Si la V3/V3.1 fonctionne déjà sur votre projet Supabase, **ne réexécutez pas la migration SQL** pour installer la V3.2.


## V3.2.2 — Above-the-fold UX

Cette version ne modifie ni Supabase ni les fonctionnalités validées. Elle réorganise l’accueil pour que **Trouver un partenaire**, **Covoiturage** et **Mes messages** soient visibles immédiatement à l’ouverture sur les écrans courants, sans devoir faire défiler un grand hero. Le bouton intermédiaire « Commencer » a été supprimé : l’utilisateur choisit directement son besoin.

Si votre base V3 fonctionne déjà, **ne réexécutez pas la migration SQL**.