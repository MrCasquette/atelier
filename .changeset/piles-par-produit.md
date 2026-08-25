---
'@echoppe/api': patch
'@echoppe/admin': patch
---

Les commandes du dépôt nomment leur produit (ADR-0066). Chaque produit possède sa pile Compose —
`infra/echoppe/compose.yaml`, `infra/prisme/compose.yaml` —, le `compose.yaml` racine disparaît avec
le `.env` racine, et le profil `release` est retiré : il pointait la base du poste, pas une base
vierge, alors que `test:image` en fait la preuve complète depuis un Postgres éphémère.

Rien ne change dans l'image publiée ni dans ce qu'elle lit : ces noms sont ceux du dépôt, un contrat
avec le contributeur seul. Une boutique installée garde son `compose.yaml`, scaffoldé par
`create-echoppe`, et ses variables.
