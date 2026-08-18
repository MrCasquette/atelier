---
'@echoppe/api': minor
'@echoppe/admin': minor
---

Rembourser un paiement par virement ou par chèque répond une faute, plus une erreur serveur.

La colonne `payment.provider` accepte quatre valeurs — `stripe`, `paypal`, `bank_transfer`,
`check` — mais seules les deux premières ont un adapter. La route de remboursement affirmait que
toute valeur lue en base était un provider outillé, ce qui envoyait les deux autres dans
`getPaymentAdapter`, où elles levaient « Unknown provider » : une 500 avec incident, là où c'est un
refus métier parfaitement clair. Un virement se rembourse hors ligne, et l'API le dit désormais.

Le jeton de session est également vérifié avant usage : Elysia expose les valeurs de cookies en
`unknown` — c'est une frontière — et onze endroits affirmaient y trouver une chaîne.
