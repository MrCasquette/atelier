#!/usr/bin/env sh
# Publication npm des paquets publiables (@axiome-apps/atelier-content, @axiome-apps/atelier-prose,
# @axiome-apps/echoppe-client, create-echoppe).
#
# Politique de versions (ADR-0023) : mode pre changesets DÉSACTIVÉ → tout part sur le dist-tag
# « latest » (le 0.x EST le signal « pré-1.0 » par convention semver, pas de suffixe -next).
#
# `--no-git-tag` : les paquets ne sont PAS taggés en git — npm est leur registre de versions.
# Seule l'épine produit runtime (api+admin) porte des tags git `v*` (posés par release.yml).
set -e

# Build des paquets publiables (dist requis dans le tarball).
#
# `--filter` plutôt qu'une liste : Bun DÉCOUVRE les paquets qui ont un script `build` et les exécute
# DANS L'ORDRE DU GRAPHE de dépendances. Les deux comptent — un paquet publiable neuf n'a plus à
# être ajouté ici, et `atelier-content` se construit après `atelier-prose`, dont il consomme le
# `dist`. L'ordre écrit à la main a précisément raté ce cas : la liste énumérait `content` en tête,
# et le publish aurait échoué au merge sur un `Cannot find module`.
bun run --filter './packages/*' build

bunx changeset publish --no-git-tag
