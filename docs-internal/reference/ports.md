# Configuration des ports

## Ports par défaut

| Service | Port | Signification |
|---------|------|---------------|
| Store | `3141` | π (Pi) |
| Admin | `3211` | 1123 inversé (Fibonacci) |
| API | `7532` | 2357 inversé (Nombres premiers) |

## Pourquoi ces choix ?

### Une identité mathématique

Axiome signifie *une vérité évidente, simple, fondamentale*. Les ports d'Échoppe reflètent cette philosophie en s'appuyant sur des constantes et suites mathématiques universelles :

- **3141** — Les premiers chiffres de π, la constante la plus reconnaissable. Le store est la vitrine publique, ce que le monde voit en premier.

- **3211** — La suite de Fibonacci (1, 1, 2, 3) lue à l'envers. Fibonacci représente la croissance organique — approprié pour l'interface d'administration où l'on fait grandir son commerce.

- **7532** — Les quatre premiers nombres premiers (2, 3, 5, 7) en miroir. Les nombres premiers sont les briques élémentaires des mathématiques — comme l'API est la fondation technique de l'application.

### Le miroir comme signature

Deux des trois ports sont des inversions. C'est intentionnel : un axiome est une vérité qu'on peut lire dans tous les sens. Échoppe propose une autre perspective sur le e-commerce pour artisans.

### Logique technique

- **3xxx** pour les frontends (Store & Admin) — reste dans la plage conventionnelle des applications web
- **7xxx** pour le backend (API) — séparation claire, zone peu encombrée

## Pour les DevOps

Ces ports sont des *defaults*, pas des contraintes. Chaque port est configurable via variables d'environnement :

```dotenv
# .env
STORE_PORT=3141
ADMIN_PORT=3211
API_PORT=7532
```

Vous préférez une configuration classique ? Aucun problème :

```dotenv
STORE_PORT=3000
ADMIN_PORT=3001
API_PORT=8000
```

### Deux plages : l'identité (prod) et le +1 (dev)

`7532` / `3211` / `3141` sont **LES** ports d'Échoppe. Ils appartiennent au produit : les images
Docker, la prod, le template `create-echoppe`, les défauts du code, et `.env.example` qui les porte
tels quels. **Ils ne bougent pas** — c'est la cible, pas une valeur de circonstance.

Le décalage **+1** est une accommodation **locale**, et rien d'autre. Raison : une pile Échoppe de
prod tourne souvent sur la même machine (une instance de démo, un déploiement local) et occupe déjà
l'identité. Sans décalage, `bun run dev` échoue en `EADDRINUSE` — sur l'API comme sur l'admin.

| Service | Le port (produit, prod, `.env.example`) | Poste de dev encombré |
|---------|------------------------------------------|-----------------------|
| API | `7532` | `7533` |
| Admin | `3211` | `3212` |
| Store | `3141` | `3142` |

Le décalage vit dans **deux endroits, et deux seulement** :

- le **`.env` racine, non versionné** (`API_PORT` / `ADMIN_PORT` / `STORE_PORT` + les URL de CORS).
  C'est lui qui pilote `bun run dev`, le proxy Vite de l'admin (`vite.config.ts` lit `API_PORT` et
  `ADMIN_PORT` à la racine) et le store. Chacun l'ajuste à sa machine ; `.env.example` ne le suit
  pas ;
- **`compose.dev.yaml`**, la pile Docker construite depuis les sources, qui publie sur
  `${API_PORT:-7533}` et `${ADMIN_PORT:-3212}`. Le port **interne** du conteneur reste `7532` —
  c'est celui du `Dockerfile`, de son `EXPOSE` et de son healthcheck. Seul le mapping hôte se
  décale, et un `.env` le surcharge.

Nulle part ailleurs. Les défauts en dur du code (`API_PORT ?? 7532` dans `src/index.ts`, les
`|| 'http://localhost:7532'` de l'admin, `compose.yaml`, tout `packages/create-echoppe`) restent
sur l'identité : ils décrivent le produit livré, pas le poste de travail.

**Un consommateur à connaître** : `packages/echoppe-client/scripts/generate.ts` interroge
`http://localhost:7533/docs/json` pour régénérer le SDK. Il vise donc l'API **des sources**, pas un
conteneur. Override par `CONTRACT_API_URL` pour pointer ailleurs — c'est ce que fait le test
d'intégration, qui vise l'API du conteneur.

`7533`, `3212` et `3142` n'ont aucune valeur symbolique : ce sont des ports de travail local, pas
une identité produit.

### Pourquoi des ports "originaux" par défaut ?

1. **Éviter les conflits** — Les ports standards (3000, 8000, 8080) sont souvent déjà occupés en environnement de développement
2. **Identité** — Comme Directus avec son 8055, des ports reconnaissables créent une signature technique
3. **Zéro ambiguïté** — En voyant `3141` dans vos logs, vous savez immédiatement que c'est Échoppe

## Vérification des conflits

| Port | Conflits connus | Verdict |
|------|-----------------|---------|
| 3141 | Aucun | ✓ Safe |
| 3211 | Aucun | ✓ Safe |
| 7532 | Aucun | ✓ Safe |

---

*Échoppe fait partie d'[Axiome](https://axiome.app), une organisation open source créant des outils pour les artisans.*
