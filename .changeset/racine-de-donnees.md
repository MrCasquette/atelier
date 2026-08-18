---
'create-echoppe': minor
---

Le `compose.yaml` scaffoldé monte le volume sur `/data` au lieu de `/app/uploads` (ADR-0056) : les
données quittent le répertoire que l'image possède, et une nature ajoutée plus tard devient un
sous-dossier sans volume à déclarer. Une boutique déjà créée doit déplacer ses fichiers d'un cran
dans son volume avant de passer à cette image — cf. ADR-0056.
