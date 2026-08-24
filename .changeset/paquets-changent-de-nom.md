---
'@axiome-apps/atelier-content': minor
'@axiome-apps/echoppe-client': minor
---

Les paquets publiés changent de nom (ADR-0063). `@mrcasquette/content` devient
`@axiome-apps/atelier-content`, `@echoppe/client` devient `@axiome-apps/echoppe-client`.

Le scope dit qui publie, le préfixe du nom dit à quoi le paquet appartient — `atelier-` pour ce qui
est partagé par les deux produits, le nom du produit pour ce qui lui appartient. `create-echoppe`
garde son nom nu : `npm create echoppe` exige un paquet nommé exactement ainsi.

Les anciens noms cessent d'être mis à jour. Rien ne casse pour une installation existante, mais elle
n'aura plus de version nouvelle : `bun add @axiome-apps/echoppe-client` remplace
`bun add @echoppe/client`, à version égale.
