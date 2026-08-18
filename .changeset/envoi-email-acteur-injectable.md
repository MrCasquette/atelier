---
'@echoppe/api': minor
'@echoppe/admin': minor
---

L'envoi d'e-mails devient un acteur composé au démarrage.

`sendEmail` résolvait son adapter par un singleton de module aux fabriques câblées en dur, et lisait
la base directement pour l'identité du site, le journal et la disponibilité des providers. Aucune
couture ne permettait de substituer un faux : seule l'absence de provider configuré dans la base de
test empêchait un envoi réel depuis une suite.

`CommunicationService` reçoit désormais ses quatre dépendances, que le produit branche dans sa
racine de composition et qu'un test remplace. Le chemin d'envoi est couvert pour la première fois —
sans base, sans réseau. `@repo/identity` sort au passage des dépendances de `@repo/communication`.

Aucun changement de contrat HTTP ni de comportement observable.
