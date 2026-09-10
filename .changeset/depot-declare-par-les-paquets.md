---
'@axiome-apps/atelier-content': patch
'@axiome-apps/atelier-prose': patch
'@axiome-apps/echoppe-client': patch
'create-echoppe': patch
---

Chaque paquet publié déclare le dépôt d'où il vient — `repository`, `directory` compris.

npm signe la provenance de lui-même sous trusted publishing, et refuse la publication d'un paquet qui
ne nomme pas son dépôt d'origine. Rien ne change pour un consommateur : c'est une métadonnée, qui
donne à npm le lien vers le source du paquet dans le monorepo.
