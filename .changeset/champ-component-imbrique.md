---
'@axiome-apps/atelier-content': minor
---

Un component imbriqué peut être requis (ADR-0075). `f.component(of, méta)` déclare l'imbrication
d'un component nommé et porte `label`, `hint`, `required` — ce que la définition écrite nue
(`cta: link`) n'a nulle part où loger, alors que le registre le déclarait, que le validateur
l'appliquait et que l'admin le rendait déjà.

La forme nue reste valide, produit la même donnée et le même type inféré, et pousse exactement le
JSON qu'elle poussait : un dépôt qui n'y touche pas ne voit rien changer.

`FieldNode` (l'union des onze descripteurs) et `FieldValue` (un descripteur ou une définition nue)
sont désormais exportés : ils manquaient à la surface, qui exportait déjà chaque membre et `Fields`.
