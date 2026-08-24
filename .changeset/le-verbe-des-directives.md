---
'@axiome-apps/atelier-content': minor
---

`defineDirective` — le vocabulaire d'authoring d'une prose.

Un dev peut déclarer les directives que son front sait rendre, à côté de `defineSection`. Elles
entrent dans `defineContent` par leur propre champ et **rien n'en va en base** : pas de table, pas
de poussée, pas de cache à invalider. `directiveRegistry()` rend le noyau plus ce qui est déclaré —
sans lui, passer ses seules directives à `proseIssues` perdrait silencieusement la validation du
noyau.

Le noyau est fermé : `defineDirective` refuse de redéfinir `warning`, `note`, `tip`, `figure`,
`quote`, `cta` ou `highlight` (ADR-0061 §4).
