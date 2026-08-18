# @echoppe/api

## 0.8.0

### Minor Changes

- 667537d: Le cœur cesse de prêter sa surface aux paquets partagés.

  `@echoppe/core` réexportait 54 symboles empruntés à sept paquets `@repo/*`. Chacun est retourné à
  son paquet d'origine, et l'API déclare enfin les quatre dépendances qu'elle consommait sans les
  nommer. Le manifeste de migration vit désormais dans un fichier hors des `exports` du paquet, donc
  inatteignable par un import : le raccourci devient impossible plutôt qu'interdit.

  Aucun changement de comportement ni de contrat HTTP — c'est une réorganisation interne. L'image est
  reconstruite parce que 65 fichiers du runtime ont bougé, pas parce qu'elle fait autre chose.

## 0.7.0

### Minor Changes

- 7d0f246: **Cassant pour un déploiement existant** — le runtime change de surface, de port, de racine de
  données et de mode d'amorçage. Aucune boutique n'étant déployée, il n'y a pas de compatibilité
  ascendante à tenir ; la version reste `0.x` parce que le développement est actif, pas parce que la
  rupture serait petite.

  **Une seule image, une seule surface** (ADR-0052). Le dashboard est servi par l'API sous `/-/admin`
  au lieu d'être une image à lui. Les surfaces d'exploitation quittent l'espace des ressources et se
  regroupent sous `/-/` : `/-/health`, `/-/docs`, `/-/docs/json`. `VITE_API_URL` disparaît — le
  dashboard lit l'origine qui le sert, au lieu de la figer à la compilation.

  **Le port interne vaut `8100`** (ADR-0054), partout et dans toutes les piles. `7532` ne survit
  nulle part. Le mapping publié appartient à l'instance : `API_PORT` reste la variable de l'exploitant
  et ne déplace jamais le port interne.

  **Les données vivent sous `/data`** (ADR-0056), hors du répertoire que l'image possède.
  `UPLOAD_DIR` vaut `/data/uploads`. Le volume se monte sur `/data` : une nature de données ajoutée
  plus tard devient un sous-dossier, sans volume à déclarer chez l'exploitant.

  ```diff
   volumes:
  -  - echoppe-uploads:/app/uploads
  +  - echoppe-uploads:/data
  ```

  **Le compte administrateur ne se configure plus** (ADR-0057). `ADMIN_EMAIL` et `ADMIN_PASSWORD`
  sont supprimées : le propriétaire se crée après le démarrage, au terminal, sans qu'aucun mot de
  passe ne transite par un fichier.

  ```bash
  docker compose exec -it api ./api admin:create
  ```

  **Les commandes d'exploitation passent par le binaire.** L'image ne contient ni sources ni
  `package.json` : `bun run api-key:create` n'y a jamais existé, malgré la documentation. C'est
  désormais `./api api-key:create --name front --scopes write:schema`.

## 0.6.0

### Minor Changes

- 4e5a8b4: expose l'id de la variante par defaut sur les cartes produit (products/, related, categories, collections)
