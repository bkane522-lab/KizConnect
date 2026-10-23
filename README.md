# KizConnect V3.9 — Neon Dance & Map

**KizConnect — Trouvez avec qui danser.**

Cette version conserve la connexion Google validée et refond l’accueil pour donner une hiérarchie beaucoup plus claire : **Trouver un partenaire** devient l’action principale, tandis que covoiturage et messages restent accessibles immédiatement.

## Parcours recommandé

**Connexion → Continuer avec Google → choisir son compte Google → retour dans KizConnect.**

- aucun mot de passe KizConnect à mémoriser avec Google ;
- le login email + mot de passe reste disponible pour les comptes existants ;
- les actions en attente (message, training, covoiturage…) reprennent après la connexion ;
- un nouveau compte Google complète son profil une seule fois si la ville manque ;
- aucune nouvelle migration SQL.

## Configuration Google — une seule fois

1. Dans **Supabase → Authentication → Sign In / Providers → Google**, activer Google.
2. Dans Google Cloud, créer des identifiants OAuth 2.0 de type **Web application**.
3. Copier l'URL de callback affichée par Supabase dans les **Authorized redirect URIs** de Google. Elle ressemble à :
   `https://VOTRE-PROJET.supabase.co/auth/v1/callback`
4. Mettre le **Client ID** et le **Client Secret** Google dans le provider Google de Supabase.
5. Conserver dans Supabase **Site URL** : `https://kiz-connect.vercel.app` et la redirect URL correspondante.

> Aucun SQL supplémentaire n'est nécessaire. Les migrations `001` à `004` restent inchangées.

## Fonctionnalités conservées

- recherche partenaire par ville et rayon 5 / 10 / 25 / 50 km ;
- multi-sélection styles, niveaux et rôles ;
- rôle Leader / Follower / Les deux ;
- Connexion training privée et mutuelle ;
- trainings organisés ;
- covoiturage ;
- messagerie privée ;
- blocage et signalement ;
- retours bêta ;
- PWA avec détection de mise à jour ;
- Supabase Auth + RLS.

## Installation locale

```bash
npm install
cp .env.example .env
npm run dev
```

## Tests

```bash
npm run check
npm run build
```


## V3.8
Accueil néon et navigation basse, sans migration SQL. Voir docs/V3.8_DESIGN.md.


## V3.9 — Neon Dance & Map
- le cœur est supprimé : identité visuelle centrée sur le mouvement, les trajectoires et les pas de danse ;
- la carte « Partenaires sur la carte » ouvre une vraie carte OpenStreetMap ;
- les profils sont positionnés à partir de leur ville, jamais de leur adresse exacte ni du GPS ;
- la recherche classique et tous les parcours V3.8 restent disponibles ;
- aucune migration SQL supplémentaire.


## V3.9.1 — Correctif mobile
- Carte Leaflet intégrée au bundle Vite : plus de dépendance au CDN unpkg.
- Accueil mobile compacté pour réduire fortement le scroll.
- Aucun changement SQL Supabase.


## V3.9.2 — Recherche / carte robuste
- La recherche partenaire retombe automatiquement sur les champs de profil de base si des colonnes optionnelles V3.4/V3.5 ne sont pas encore disponibles dans Supabase.
- La carte réutilise cette recherche compatible et ne tombe plus en panne uniquement à cause d'une colonne optionnelle manquante.
- Aucun SQL n'est requis pour la recherche et la carte de base. Les fonctions avancées nécessitent toujours les migrations 003/004.


## V3.9.3 — Photos de profil jusqu'à 5 Mo
- limite frontend portée à 5 Mo ;
- texte d'interface mis à jour ;
- bucket Supabase `avatars` porté à 5 Mo via la migration `005_kizconnect_v3_9_3_avatar_5mb.sql` ;
- formats conservés : JPG, PNG et WebP.


## V3.9.4 — Accueil réorganisé
- la section **Découvrir** passe juste sous le hero pour être visible beaucoup plus tôt ;
- **Que cherchez-vous ?** vient ensuite ;
- **Donner mon avis** descend sous les actions principales ;
- aucun changement Supabase ou SQL.
