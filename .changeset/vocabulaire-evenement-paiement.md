---
'@echoppe/api': minor
'@echoppe/admin': minor
---

Le vocabulaire des événements de paiement se ferme, et le test d'e-mail passe par le journal.

`payment_event.type` était un `varchar` libre dont le commentaire annonçait cinq valeurs, dont deux
n'ont jamais été écrites — tandis qu'une sixième l'était sans être annoncée. Surtout, un
remboursement s'inscrivait `refund` à un endroit et `refunded` à un autre : deux valeurs pour un
même événement, qu'une colonne libre acceptait sans broncher. La colonne devient un enum
PostgreSQL, et la correspondance statut → événement une table exhaustive.

Le test de configuration d'un provider écrivait sa propre ligne dans `communication_log`, en
dupliquant jusqu'à la traduction du statut ; il passe désormais par le service, comme tout envoi.

**Migration incluse.** Elle convertit `payment_event.type` en enum. Les lignes portant une valeur
hors du nouvel ensemble feraient échouer la conversion — aucune installation n'est concernée à ce
stade.
