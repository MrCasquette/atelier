# ADR-0002 — Distribution : Docker (runtime) + npm (SDK/CLI), modèle déploiement A

Statut : accepté · 2026-07-06 → 2026-07-08 · politique de tags/versions affinée par [ADR-0023](./ADR-0023-versioning-tags.md)

> **Amendement 2026-07-31 — registre des images.** Le monorepo est passé en privé
> (`MrCasquette/atelier`). Les images runtime ne sont plus publiées sur Docker Hub public mais sur
> **GHCR privé** (`ghcr.io/mrcasquette/echoppe-{api,admin}`) : les tirer exige un PAT `read:packages`.
> Les deux canaux et le modèle A restent valides ; seul le registre et sa visibilité changent. Le
> canal npm est inchangé — `@echoppe/client` et `create-echoppe` restent publics. `@echoppe/content`
> est renommé en `@mrcasquette/content` (brique agnostique, donc hors scope produit — cf.
> [ADR-0012](./ADR-0012-module-contenu.md)).

## Contexte

Échoppe vise un framework e-commerce clé en main « à la Medusa » : backend déployable + front
agnostique connecté via l'API + CLI de scaffolding. Deux publics distincts : celui qui **héberge**
Échoppe (runtime) et celui qui **développe** un front (librairies).

## Options envisagées

- **Canal de distribution** : Docker seul (ne peut pas fournir un client à importer) vs npm seul (ne
  fait pas tourner le backend) vs **les deux, complémentaires**.
- **Modèle de customisation** : A (images opaques + fork du repo boutique) · B (full-source) ·
  C (framework-as-dependency, Medusa-like).

## Décision

- **Deux canaux complémentaires** : **Docker Hub** distribue les images runtime (`axiomeapp/echoppe-api`,
  `echoppe-admin`, multi-arch amd64+arm64) ; **npm** distribue le SDK `@echoppe/client` et la CLI
  `create-echoppe`.
- **Modèle A (raffiné)** : API + Admin = images Docker opaques ; la CLI scaffolde le front Astro + un
  `compose.yaml` qui tire les images + `.env` pré-rempli. Customisation API/Admin = fork. Modules/
  thèmes = post-1.0. Modèle C = cap 2.0.
- Stack backend lean = **db + api + admin** (Redis optionnel, `init` retiré).
- **Repo boutique = hors monorepo** (règle non négociable : consommateur, pas morceau du framework).
- Publication npm via **Trusted Publishing OIDC** (zéro token), canal unique `latest`, semver 0.x.

## Conséquences

- Versioning SDK **aligné** sur les tags Docker de l'API (contrat co-versionné).
- `apps/store` (ex-Next) remplacé par un exemple Astro ; stage `store`/`init` retirés du Dockerfile.
- Licence **CeCILL v2.1** sur tout le projet (paquets publiables inclus).

## Détail

→ [distribution-architecture.md](../reference/distribution-architecture.md) (canaux, repo split, release CI,
images Docker, historique npm).
