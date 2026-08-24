---
'@echoppe/api': patch
'@echoppe/admin': patch
---

Reconstruit l'image du runtime depuis `main`. La `0.8.0` publiée sur GHCR ne correspond pas au code
de la version `0.8.0` : elle a été construite le 2026-08-18 depuis un commit `Version Packages` de
branche de PR, qu'aucune branche ne contient, à cause d'un tag posé sur `HEAD` après que l'action
changesets l'eut déplacé.

**Le numéro `0.8.0` est brûlé côté image.** Elle ne contient ni le renommage des paquets npm, ni ce
qui a été fusionné depuis le 18 août. Elle n'est pas réécrite — un artefact publié ne se réécrit pas —
mais elle ne doit pas être déployée. `0.8.1` est la première image du runtime qui corresponde à son
numéro, et `latest` la suivra.

Les paquets npm de `0.8.0`, eux, sont corrects : ils ont été publiés depuis `main`.
