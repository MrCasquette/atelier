---
'@axiome-apps/atelier-content': patch
'create-echoppe': patch
'@axiome-apps/echoppe-client': patch
---

Plus aucune assertion de type dans ces paquets.

`@axiome-apps/atelier-content` — `defineContent` passe par deux surcharges au lieu d'un paramètre de type
par défaut, et les constructeurs de champs composent par `Object.assign`, dont la signature produit
nativement l'intersection qu'on affirmait. La surface publique et les types inférés sont identiques.
Reste une exception, signalée dans le code : `asSections` est par construction une affirmation —
sans validation, aucune expression ne mène de `RawSection[]` au type déclaré par le développeur.

`create-echoppe` — le `package.json` du template est vérifié avant d'être personnalisé. Un fichier
tronqué à l'installation échouait trois lignes plus loin, sur une propriété absente.

`@axiome-apps/echoppe-client` — le générateur du SDK vérifie que la spec OpenAPI téléchargée porte bien des
chemins, au lieu de l'affirmer. Le contrat produit est identique, `contracts:check` le confirme.
