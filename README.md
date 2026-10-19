## V3.6.5 — Mot de passe oublié par code

Cette version remplace les liens de récupération par un code à 6 chiffres envoyé par email.

Parcours : **Email → code à 6 chiffres → nouveau mot de passe → connecté**.

- aucun lien Supabase à ouvrir ;
- aucun `redirectTo` nécessaire ;
- code vérifié dans KizConnect avec `verifyOtp(... type: "recovery")` ;
- possibilité de renvoyer un nouveau code ;
- aucune nouvelle migration SQL.

# KizConnect V3.6.5

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

Aucune nouvelle migration pour V3.6.5. Conservez les migrations `001` à `004` déjà installées.

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

## Supabase — modèle email Reset password

Dans **Authentication → Emails → Reset password**, remplacez le contenu qui contient un lien de confirmation par un message qui affiche le code :

```html
<h2>Réinitialisation de votre mot de passe KizConnect</h2>
<p>Votre code de vérification :</p>
<h1>{{ .Token }}</h1>
<p>Saisissez ce code dans KizConnect pour choisir un nouveau mot de passe.</p>
```

Le modèle ne doit plus obliger l'utilisateur à ouvrir `{{ .ConfirmationURL }}` pour ce parcours.
