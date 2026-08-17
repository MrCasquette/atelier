#!/usr/bin/env sh
# Publication npm des paquets publiables (@mrcasquette/content, @echoppe/client, create-echoppe).
#
# Politique de versions (ADR-0023) : mode pre changesets DÉSACTIVÉ → tout part sur le dist-tag
# « latest » (le 0.x EST le signal « pré-1.0 » par convention semver, pas de suffixe -next).
#
# `--no-git-tag` : les paquets ne sont PAS taggés en git — npm est leur registre de versions.
# Seule l'épine produit runtime (api+admin) porte des tags git `v*` (posés par release.yml).
set -e

# Build des paquets publiables (dist requis dans le tarball).
bun run --cwd packages/content build
bun run --cwd packages/echoppe-client build
bun run --cwd packages/create-echoppe build

bunx changeset publish --no-git-tag
