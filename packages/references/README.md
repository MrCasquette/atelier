# `@repo/references` — le registre des cibles référençables

Le socle sait qu'il **existe** des cibles référençables ; il ne sait pas lesquelles
([ADR-0032](../../docs-internal/adr/ADR-0032-cibles-referencables.md)).

## Le problème résolu

Un lien — d'un item de menu, d'un champ `ref` d'une section — désigne une entité. Le socle
connaissait ces entités en dur : `'url' | 'page' | 'product' | 'collection' | 'category'`, répétée à
sept endroits, jusque dans le paquet publié. Le vocabulaire de l'e-commerce était écrit dans un socle
que Prisme doit consommer.

Ici, le socle ne sait plus qu'une chose : il existe des cibles, et voici comment les lister et les
résoudre. Échoppe inscrit les siennes, Prisme inscrira les siennes.

## Frontière

Ce fichier ne connaît **ni base, ni HTTP** : il déclare le contrat, le produit l'implémente. Une
cible fournit elle-même `project()` et `search()`, parce qu'elle seule sait interroger sa table.

## Deux principes structurants

**Opt-in, jamais opt-out.** Ce qui rend une entité référençable, ce n'est pas d'être déclarée, c'est
d'**avoir une URL**. Une entité n'entre au registre que si elle dit comment elle produit un lien — le
silence la rend invisible dans le sélecteur, sans avoir à la marquer négativement.

**Le silence n'est jamais une faute.** Même forme pour `storage` : une cible adossée à une vue, à
plusieurs tables ou à un système externe ne le déclare pas, et le champ qui la vise garde un `uuid`
nu. L'appelant n'a pas à distinguer « pas de stockage déclaré » de « cible inconnue ».

## Les trois modes de lien

Ils ne sont pas réductibles les uns aux autres : un article **est** une page, un lien de réseau
social **porte** une URL, une section de page n'a de lien **que par sa parente**. `href` et `anchor`
nomment un *champ* de l'entité, pas un concept
([ADR-0046](../../docs-internal/adr/ADR-0046-entites-referencables.md)) — nommer un concept obligerait
à deviner par où l'atteindre, et une entité peut référencer deux pages.

**La déclaration fait foi.** Rien ne garantit techniquement que la route déclarée existe encore dans
le front du dev. Un lien cassé est un 404, pas une corruption.

## Dépendances

Aucune.
