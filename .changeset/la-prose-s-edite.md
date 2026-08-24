---
'@echoppe/api': minor
---

Un champ de texte riche s'édite enfin comme de la prose.

L'administration affiche la source, son aperçu, ce qui ne va pas, et une barre qui insère les
directives du noyau au curseur. Un `richText` était jusqu'ici un `<textarea>` nu : la syntaxe
`:::warning` s'y tapait de mémoire, et rien ne disait si elle avait pris.

Un seul parse sert les trois : l'aperçu est le rendu de production, et les constats viennent avec
lui. Rien n'est refusé pour autant — un brouillon reste enregistrable, la correction se propose
(ADR-0064).
