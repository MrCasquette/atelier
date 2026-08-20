# Conservation des factures — instruction préalable

> Note de chantier. Elle disparaît avec l'ADR qu'elle prépare — cf.
> [conventions § Tenue des backlogs](../reference/conventions.md#tenue-des-backlogs).
> Entrée de la [roadmap Échoppe](./roadmap-echoppe.md).

## Le constat

Une facture est aujourd'hui un `media` comme un autre : même table, même dossier que les images de
produits, même route de suppression. `media/service.ts:193` fait un `unlink` réel — effacer une
image depuis la médiathèque et effacer une facture sont le même geste, avec le même effet.

Or une facture relève d'une obligation légale de conservation. Rien dans le code ne distingue les
deux, et rien ne signale l'écart.

## Ce qui n'est pas la question

Où le fichier vit. [ADR-0056](../adr/ADR-0056-racine-de-donnees.md) a monté les données sous `/data`,
ce qui les sort du répertoire que l'image possède — mais un volume ne garantit pas une durée de
conservation, il garantit une persistance.

## La question

Ce qui garantit qu'un document comptable vit assez longtemps, et qu'on peut le **prouver**.

Pistes à instruire avant de choisir, sans ordre de préférence :

- une nature de média non supprimable, distincte dans le schéma ;
- un stockage dédié, cloud ou auto-hébergeable, avec rétention et journal d'accès ;
- un paquet spécialisé dans l'archivage à valeur probante ;
- la régénération à la demande depuis la commande, qui déplace la garantie sur la donnée plutôt que
  sur le fichier.

À trancher en ADR. Voir aussi [ADR-0017](../adr/ADR-0017-documents-typst.md) pour la génération.
