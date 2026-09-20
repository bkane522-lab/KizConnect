
## V3.6 — Recherche partenaire plus directe

La recherche partenaire n’utilise plus les menus déroulants natifs pour les filtres principaux.

- rayon visible : Ville exacte, 5, 10, 25 ou 50 km ;
- plusieurs styles peuvent être sélectionnés ;
- plusieurs niveaux peuvent être sélectionnés ;
- plusieurs rôles peuvent être sélectionnés ;
- le choix `Tous` / `Peu importe` se réactive automatiquement si aucun filtre spécifique n’est sélectionné ;
- aucune nouvelle migration Supabase n’est nécessaire par rapport à la V3.5.

# KizConnect V3.6 — rôles de danse

**KizConnect — Trouvez avec qui danser.**

V3.5 conserve les fonctions validées de la bêta et ajoute un retour utilisateur simple : le rôle de danse **Leader / Follower / Les deux**. Le rôle reste facultatif et n'est jamais associé au genre.

## Fonctionnalités principales

- recherche partenaire par ville, rayon, style, niveau et rôle facultatif ;
- rayon 5 / 10 / 25 / 50 km autour d'une commune française ;
- profil : pseudo, ville, niveau, styles, rôle, bio, photo facultative ;
- Connexion training mutuelle et privée ;
- demandes de training ;
- covoiturage ;
- messagerie privée ;
- blocage et signalement ;
- retours bêta ;
- PWA avec détection de mise à jour ;
- Supabase Auth + RLS.

## Rôle de danse

Dans **Mon profil**, l'utilisateur peut laisser le champ vide ou choisir :

- `Leader`
- `Follower`
- `Les deux`

Dans **Trouver un partenaire**, le filtre est également facultatif :

- une recherche `Leader` inclut `Leader` + `Les deux` ;
- une recherche `Follower` inclut `Follower` + `Les deux` ;
- une recherche `Les deux` vise uniquement les profils `Les deux`.

## Mise à jour depuis V3.4

Conserver les migrations déjà exécutées et lancer **une seule fois** :

`supabase/migrations/004_kizconnect_v3_5_dance_role.sql`

Ne rejouez pas `001`, `002` ou `003` si elles sont déjà installées.

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
