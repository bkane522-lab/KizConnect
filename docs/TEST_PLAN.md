# Plan de test V3 — avant publication

Ce plan nécessite un vrai projet Supabase et deux comptes de test distincts, par exemple **Compte A** et **Compte B**.

## Parcours visiteur

1. Ouvrir KizConnect sans compte.
2. Vérifier que l'accueil présente seulement Partenaire, Covoiturage et Messages.
3. Rechercher des partenaires sans connexion.
4. Rechercher des covoiturages sans connexion.
5. Cliquer sur « Envoyer un message » : l'inscription / connexion doit être demandée.

## Comptes et profils

1. Créer A et B.
2. Modifier le profil A connecté : autorisé.
3. Depuis le client A, tenter de modifier l'UUID de B via la console : la requête doit être refusée par RLS.
4. Vérifier qu'aucun email n'apparaît dans les réponses `profiles`.

## Training

1. A publie un training.
2. B le voit.
3. B tente de supprimer l'ID du training de A : refus RLS attendu.
4. A supprime son training : autorisé.
5. Tenter une date passée : refus attendu.

## Covoiturage

1. A publie un trajet.
2. B le trouve par ville, destination et événement.
3. B tente de supprimer le trajet de A : refus RLS attendu.
4. A le supprime : autorisé.

## Messagerie

1. A contacte B.
2. B ouvre la conversation.
3. Envoyer un message A → B : le message doit apparaître chez B sans recharger la page.
4. Avec un troisième compte C, tenter de lire l'ID de conversation A/B : aucun message ne doit être retourné.
5. Tenter d'insérer un message avec `sender_id = B` depuis la session A : refus attendu.

## Masquage

1. A masque la conversation A/B : elle disparaît uniquement de la liste de A.
2. B envoie un nouveau message : la conversation doit réapparaître chez A.

## Blocage

1. A bloque B.
2. A ou B tente d'envoyer un nouveau message : refus attendu.
3. A débloque B.
4. Une nouvelle conversation / un nouveau message doit redevenir possible.

## Signalement

1. A signale B.
2. A peut voir son propre signalement via la base si nécessaire.
3. B ne doit pas pouvoir lire le signalement de A.

## Avatar

1. A charge une image JPG/PNG/WebP < 2 Mo : autorisé.
2. A tente un fichier > 2 Mo : refus côté interface / Storage.
3. B tente d'écrire dans le dossier Storage de A : refus attendu.

## Validation finale

La V3 peut être considérée comme bêta validée seulement lorsque tous les tests ci-dessus passent sur le projet Supabase destiné à la bêta.
