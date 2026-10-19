## V3.6.4 — Mot de passe oublié

Cette version ajoute un parcours simple et sécurisé de récupération de mot de passe, sans changer la base Supabase.

- lien **Mot de passe oublié ?** sur l'écran de connexion ;
- saisie de l'email puis envoi d'un lien Supabase ;
- message générique pour ne pas révéler si un email possède un compte ;
- écran **Nouveau mot de passe** après validation du lien ;
- confirmation du nouveau mot de passe ;
- retour connecté dans KizConnect après changement ;
- message clair si le lien est invalide ou expiré ;
- redirection de récupération vers `https://kiz-connect.vercel.app/?recovery=1` en production ;
- aucune nouvelle migration SQL.

# KizConnect V3.6.4

**KizConnect — Trouvez avec qui danser.**

## Principe UX

Ouvrir → choisir → rechercher → contacter.

Les actions principales restent visibles et explicites. Les fonctions secondaires viennent après les résultats.

## Fonctionnalités conservées

- recherche partenaire par ville et rayon 5 / 10 / 25 / 50 km ;
- multi-sélection des styles, niveaux et rôles ;
- profil avec rôle Leader / Follower / Les deux ;
- Connexion training mutuelle et privée ;
- trainings organisés ;
- covoiturage ;
- messagerie privée ;
- blocage et signalement ;
- retours bêta ;
- PWA avec détection de mise à jour ;
- Supabase Auth + RLS.

## Supabase

Aucune nouvelle migration pour V3.6.4. Conservez les migrations `001` à `004` déjà installées.

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


## V3.6.4 — récupération de mot de passe robuste

Cette version contourne le lien GET `/auth/v1/verify` de Supabase pour la récupération de mot de passe.
Le mail de récupération doit pointer directement vers KizConnect avec `TokenHash`, puis l'application vérifie le jeton avec `verifyOtp`.

Dans **Supabase → Authentication → Emails → Reset password**, utiliser un lien de ce type :

```html
<a href="{{ .SiteURL }}?recovery=1&token_hash={{ .TokenHash }}&type=recovery">Réinitialiser mon mot de passe</a>
```

Le **Site URL** doit être `https://kiz-connect.vercel.app`.
Aucune migration SQL n'est nécessaire pour cette version.
