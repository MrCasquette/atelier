# `@repo/shared` — utilitaires purs

Deux utilitaires, sans état ni dépendance externe : le chiffrement symétrique des secrets, et la
fabrique de slugs.

## Frontière

Ce paquet est le plus bas du dépôt avec `@repo/db` : **aucune dépendance**, pas même `drizzle-orm`.
Il ne connaît ni base, ni HTTP, ni schéma. Tout ce qui entre ici doit rester une fonction pure ou une
opération sur des primitives — un utilitaire qui aurait besoin d'un contexte n'a pas sa place.

## `crypto` — chiffrement des credentials

Protège les credentials des providers de paiement, de livraison et de communication : trois paquets
en dépendent.

**La disposition des octets est un contrat de compatibilité**, pas un détail d'implémentation :
`iv (12) + authTag (16) + ciphertext`, en base64. `decrypt` la suppose, et tout credential déjà
stocké l'a adoptée — la changer rend illisible ce qui est en base. Un test la verrouille.

AES-256-GCM et non CBC pour l'**authentification** : un chiffré altéré est refusé au déchiffrement
plutôt que déchiffré de travers. C'est la propriété qui compte ici, et elle est testée.

La clé est lue à **chaque appel**, jamais au chargement du module. `ENCRYPTION_KEY`, 32 octets en
base64 — `openssl rand -base64 32`, ou `generateEncryptionKey()`.

## `slugify` — URL publiques

Quatre modules de l'API en dérivent des adresses servies et indexées. Une régression y change des URL
existantes : les cas sont fixés par des tests, pas par convention orale.

**Limite connue et assumée** : le filtre ne conserve que `[A-Za-z0-9_]` après dépliage des accents.
Un alphabet non latin ne survit pas et produit un slug vide — donc des collisions d'URL pour une
boutique qui nommerait ses produits en grec ou en japonais. Le cas n'est pas géré ; un test le rend
visible plutôt que de le laisser découvrir en production.

## Dépendances

Aucune. `node:crypto` seulement.
