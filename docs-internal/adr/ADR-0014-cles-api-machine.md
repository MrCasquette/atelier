# ADR-0014 — Authentification machine (clés d'API)

Statut : accepté
Portée : auth

## Contexte

Des clients non-interactifs (CLI, CI, intégrations) doivent appeler l'API sans session humaine. Il
faut un principal machine à portée réduite, révocable, sans réutiliser les identifiants humains.

## Options envisagées

- Réutiliser une session admin — non révocable finement, lié à un humain.
- JWT signé — révocation difficile (cf. ADR-0008).
- Clé opaque hashée, scopes ancrés sur le vocabulaire RBAC existant.

## Décision

- Clé `Authorization: Bearer eck_…` ; **seul le hash SHA-256 est stocké** (`api_key.hash`), jamais la
  clé en clair.
- **Scopes ancrés sur `RESOURCE_LIST`** (SSOT RBAC, `constants/resources.ts`) — pas de vocabulaire
  parallèle ; les scopes se dérivent en permissions à la résolution.
- `type: 'apikey'` dans le contexte RBAC : **aucun bypass owner**, `selfOnly` neutre.
- `api_key` **exclu des scopes** par construction (une clé ne gère pas les clés).
- **Gouvernance** : création réservée à l'Owner ; gestion `selfOnly` pour les admins ; révocable,
  expiration optionnelle.

## Conséquences

- Surface machine à moindre privilège, révocable, distincte des humains (ADR-0008) et du modèle RBAC
  (ADR-0013) dont elle réutilise le vocabulaire.
- Amorçage possible sans admin (bootstrap CLI).

## Détail

→ [api-keys.md](../reference/api-keys.md)
