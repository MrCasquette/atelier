# ADR-0018 — Stockage média (disque local, arbre de dossiers)

Statut : accepté
Portée : assets

## Contexte

La boutique gère des images (produits, médias de contenu). Il faut les stocker, les organiser et les
servir, dans un contexte **self-host** (image Docker autonome, pas de dépendance cloud obligatoire).

## Options envisagées

- Stockage objet cloud (S3/GCS) — dépendance externe imposée, contraire au modèle autonome.
- Base de données (bytea) — inadapté au binaire volumineux.
- **Disque local** + métadonnées en base, arbre de dossiers logique.

## Décision

- Fichiers sur **disque local** ; la table `media` porte les métadonnées (`filenameDisk` = `UUID.ext`
  sur disque, `filenameOriginal`, `mimeType`, `size`, `width`/`height`) et un rattachement optionnel à
  un `folder` (arbre logique d'organisation admin).
- Service par l'API (`/assets/:id`) ; le SDK/contrat référence les médias par **UUID** (jamais une URL
  en dur), la résolution d'URL se fait à l'affichage.

## Conséquences

- Autonomie self-host ; la persistance disque doit être montée en volume (Docker) pour survivre.
- Un stockage objet (S3) reste possible plus tard derrière la même abstraction média.
- Base pour le redimensionnement à la volée `/assets/:id?width=…` (brief B5).
