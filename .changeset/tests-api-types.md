---
'@echoppe/api': patch
'@echoppe/admin': patch
---

Les tests de l'API sont vérifiés par le compilateur.

Leur `tsconfig` n'incluait que `src/**` : ni les suites, ni les scripts n'étaient type-checkés. Les
types locaux y avaient donc dérivé sans que rien ne le signale, et les assertions s'y étaient
multipliées — puisque rien ne pouvait les contredire.

Les corps de réponse se lisent désormais par des fonctions qui vérifient et disent ce qu'elles ont
reçu. Une route qui change de forme fait échouer le test à l'endroit où la réponse arrive, avec son
contenu, au lieu d'un `undefined` plusieurs lignes plus bas.

Aucun changement de comportement : c'est de l'outillage de test.
