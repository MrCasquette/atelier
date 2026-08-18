---
'create-echoppe': minor
---

Le backend scaffoldé écoute désormais sur `8100` — le port publié appartient à l'instance, pas au
produit, et le rang 0 revient à la boutique (ADR-0054). Une boutique déjà créée n'est pas affectée :
son `.env` porte son propre `API_PORT`.
