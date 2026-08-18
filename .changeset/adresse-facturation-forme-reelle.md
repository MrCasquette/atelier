---
'@echoppe/api': minor
'@echoppe/admin': minor
---

Le pays d'une facture n'est plus `[object Object]`.

L'adresse de facturation est stockée en `jsonb`. Trois endroits en décrivaient la forme, et aucun
ne s'accordait : le checkout écrit `country` comme un objet `{ code, name }`, le seed comme une
chaîne, et la facture l'affirmait `string` à la lecture. Une facture émise plaçait donc l'objet
entier dans son champ pays.

La colonne porte désormais son type (`$type<BillingAddress>()`), déclaré d'après ce que le checkout
écrit — le seul chemin réel. Les trois autres divergences que l'affirmation masquait sont corrigées
au passage : `company` et `street2` sont nullables et non optionnels, `phone` existe.

Aucune migration : le typage `jsonb` est déclaratif. Les commandes déjà enregistrées avec un pays en
chaîne — jeux de démonstration uniquement — doivent être régénérées par `db:seed`.
