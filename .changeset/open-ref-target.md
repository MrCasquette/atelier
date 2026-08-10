---
'@mrcasquette/content': minor
---

`RefTarget` n'énumère plus les entités d'Échoppe.

Le type valait `'product' | 'collection' | 'category'` — le vocabulaire de l'e-commerce écrit dans
un paquet que tout produit consomme. Un dev qui voulait référencer ses propres entités, ou un CMS
qui n'a pas de produits, n'avaient aucun moyen de le dire.

`RefTarget` est désormais un nom libre, vérifié à la synchronisation : l'API refuse un registre qui
cite une cible qu'elle n'a pas inscrite, en nommant le champ fautif. Un nom inconnu devient une
erreur de `pushRegistry`, plus un échec au type-check.

Rien à changer dans un projet existant : `f.ref({ to: 'product' })` reste valide tant qu'Échoppe
inscrit `product`, ce qu'elle fait. L'élargissement ne casse que le code qui NARROWAIT sur le type
— exhaustivité d'un `switch` sur `RefTarget`, par exemple.
