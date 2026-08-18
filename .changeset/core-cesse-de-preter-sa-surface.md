---
'@echoppe/api': minor
'@echoppe/admin': minor
---

Le cœur cesse de prêter sa surface aux paquets partagés.

`@echoppe/core` réexportait 54 symboles empruntés à sept paquets `@repo/*`. Chacun est retourné à
son paquet d'origine, et l'API déclare enfin les quatre dépendances qu'elle consommait sans les
nommer. Le manifeste de migration vit désormais dans un fichier hors des `exports` du paquet, donc
inatteignable par un import : le raccourci devient impossible plutôt qu'interdit.

Aucun changement de comportement ni de contrat HTTP — c'est une réorganisation interne. L'image est
reconstruite parce que 65 fichiers du runtime ont bougé, pas parce qu'elle fait autre chose.
