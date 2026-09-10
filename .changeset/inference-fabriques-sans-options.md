---
'@axiome-apps/atelier-content': patch
---

`f.component(x)` et `f.list(x)` appelés **sans options** rendaient facultatifs les champs requis du
type imbriqué. `f.component(x, {})`, `f.list(x, {})` et la définition écrite nue restaient justes —
la forme fautive était donc la plus naturelle à écrire.

Un paramètre de type optionnel ne prend pas son défaut quand l'argument manque : il prend le type
**contextuel** de l'appel. En position de champ, ce contexte est `Fields`, donc `ComponentField` /
`ListField`, dont le `of: Definition` large s'intersecte avec le `of` littéral et l'écrase. Les deux
fabriques passent en surcharges : sans second paramètre de type, il n'y a plus d'intersection à
contaminer.

Bug de typage seul — `serialize()` et le validateur dérivé du registre n'ont jamais été touchés.
Aucune rupture : la surface est identique, un type redevient juste. Signalé par un consommateur du
paquet publié.
