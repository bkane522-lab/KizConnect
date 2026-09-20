## V3.6.1 — Rapidité UX

Cette version conserve toute la V3.6 et compacte le parcours **Trouver un partenaire**.

- bouton **RECHERCHER** sticky sur mobile pendant le choix des filtres ;
- titres raccourcis : Rayon, Styles, Niveaux, Rôles ;
- textes d'aide répétitifs supprimés ;
- résultats placés immédiatement après la recherche et scroll automatique vers eux ;
- **Connexion training** rendue plus compacte ;
- section **Training avec date** visuellement séparée ;
- aucune nouvelle migration Supabase par rapport à la V3.6.

# KizConnect V3.6.1

**KizConnect — Trouvez avec qui danser.**

## Fonctionnalités principales

- recherche partenaire par ville et rayon 5 / 10 / 25 / 50 km ;
- multi-sélection des styles, niveaux et rôles ;
- profil avec rôle Leader / Follower / Les deux ;
- Connexion training mutuelle et privée ;
- demandes de training datées ;
- covoiturage ;
- messagerie privée ;
- blocage et signalement ;
- retours bêta ;
- PWA avec détection de mise à jour ;
- Supabase Auth + RLS.

## Supabase

Aucune nouvelle migration pour V3.6.1. Conservez les migrations `001` à `004` déjà installées. Ne les rejouez pas si elles ont déjà été exécutées.

## Installation locale

```bash
npm install
cp .env.example .env
npm run dev
```

Variables nécessaires :

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## Tests

```bash
npm run check
npm run build
```

Voir aussi `docs/TEST_PLAN.md` et `docs/SECURITY.md`.
