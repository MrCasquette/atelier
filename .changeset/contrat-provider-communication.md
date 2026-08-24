---
'@axiome-apps/echoppe-client': patch
'@echoppe/api': minor
'@echoppe/admin': minor
---

La liste des fournisseurs d'e-mail annonce enfin lesquels.

`GET /communications/providers` rendait `id: string` alors que `POST /communications/test` exige
`resend | brevo | smtp`. Le dashboard réaffirmait donc le fournisseur entre les deux appels, pour
recoller un vocabulaire que le contrat connaissait mais ne disait pas. Les deux routes partagent
maintenant la même déclaration.

Le SDK est régénéré : le champ passe de `string` à l'union. C'est une restriction du type, sans
changement des valeurs rendues.
