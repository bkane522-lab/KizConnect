## V3.6.2 — Simple UX

Cette version ne rajoute aucune fonctionnalité. Elle simplifie **Trouver un partenaire** pour que le parcours soit compris immédiatement.

- un seul bouton **RECHERCHER**, sans bouton sticky qui masque les filtres ;
- ordre direct : **Où ? → Rayon → Styles → Niveaux → Rôles → Rechercher** ;
- résultats placés immédiatement sous le formulaire ;
- textes d'aide non indispensables supprimés ;
- **Connexion training privée** transformée en petite option secondaire ;
- **Trainings organisés** séparés clairement de la recherche partenaire ;
- aucune nouvelle migration Supabase.

# KizConnect V3.6.2

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

Aucune nouvelle migration pour V3.6.2. Conservez les migrations `001` à `004` déjà installées.

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
