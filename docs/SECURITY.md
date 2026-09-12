# Sécurité — KizConnect V3

## Identité

L'identité d'un utilisateur provient de `auth.uid()` côté Supabase. Le frontend ne peut pas choisir l'identité serveur d'un propriétaire ou d'un expéditeur.

## RLS

RLS est activée sur :

- `profiles`
- `training_requests`
- `carpool_posts`
- `conversations`
- `messages`
- `blocks`
- `reports`

Les annonces peuvent être lues publiquement lorsqu'elles sont actives, mais seul leur propriétaire peut les modifier ou les supprimer.

Les conversations et messages sont réservés aux participants.

## Conversations

La création d'une conversation passe par `start_conversation(other_user)`. La fonction récupère l'utilisateur connecté via `auth.uid()` et refuse :

- l'absence de session ;
- une conversation avec soi-même ;
- un profil indisponible ;
- une paire d'utilisateurs bloquée.

Le masquage passe par `hide_conversation()` et ne masque la conversation que pour l'utilisateur connecté.

## Blocage

Le blocage empêche l'envoi de nouveaux messages dans les deux sens. La liste des personnes bloquées n'est lisible que par le bloqueur.

## Anti-spam de base

La base limite :

- à 5 nouvelles annonces d'un même type sur 10 minutes ;
- à 30 messages par minute et par utilisateur.

Ces limites sont une première protection, pas un système complet de modération.

## Photos

Le bucket `avatars` est public en lecture car la photo fait partie du profil public. L'écriture, la modification et la suppression sont limitées au dossier portant l'UUID de l'utilisateur connecté. Taille maximale : 2 Mo. Types acceptés : JPEG, PNG, WebP.

## Données privées

`profiles` ne contient ni email, ni téléphone, ni adresse précise. L'email reste dans Supabase Auth.

Pour le covoiturage, l'interface demande uniquement une ville / zone publique ; l'adresse exacte doit être échangée en messagerie privée.
