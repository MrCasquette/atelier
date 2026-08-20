# `@repo/prose` — du texte en entrée, un arbre en sortie

Ce que le paquet livre : **la traduction d'un texte Markdown à directives en un arbre exploitable**,
et rien d'autre. Il ne rend pas, il ne stocke pas, il n'interroge personne
([ADR-0061](../../docs-internal/adr/ADR-0061-prose-directives-declarees.md)).

## Aucune dépendance interne

Ni `@repo/db`, ni `@repo/fields`, ni `@repo/shared`. C'est le paquet le plus pur du dépôt, et ce
n'est pas une coquetterie : un registre de prose se valide **sans base**, et un arbre se teste sans
DOM. Le modèle des champs a d'ailleurs été écarté volontairement — sur ses douze `kind`, une
directive en emploierait trois, et de travers : `list`, `repeater` et `component` n'ont aucun sens
dans une chaîne de caractères, et un attribut de directive est **toujours** une `string`.

## Les deux invariants, et ce qui les tient

**Le HTML brut est refusé à la source.** `htmlFlow` et `htmlText` sont désactivés dans le tokenizer,
si bien qu'un `<script>` écrit dans le contenu ressort en **texte** et sera échappé au rendu. Ce
n'est pas une consigne : c'est l'entrée qui rend la sortie close, et sans elle tout le raisonnement
de sécurité s'effondre. Deux tests en font foi.

**L'arbre est éphémère.** La base ne contient que le texte source, octet pour octet celui qui a été
écrit ; l'arbre est reconstruit à chaque rendu. Le mettre en cache en base ramènerait à un format
propriétaire avec deux sources de vérité — c'est la seule dérive qui détruirait la thèse de l'ADR
**sans qu'aucun test ne tombe**.

## Frontière

| Ici | Ailleurs |
|---|---|
| Le texte devient un arbre | Le stockage du texte, qui est un champ comme un autre |
| Ce qu'est une directive, ses trois formes | Le noyau de directives et ce que chacune produit |
| Le parcours de l'arbre | Le rendu — chez le consommateur, jamais dans le framework |

`mdast` s'arrête à `parse.ts` : au-delà, seul l'arbre de `tree.ts` circule. C'est ce qui rend l'outil
de parsing remplaçable — s'il est abandonné, on en réécrit un et **aucune donnée ne bouge**.

## Le noyau, et pourquoi il n'a que des enveloppes

Sept directives que nos thèmes s'engagent à dessiner : `warning`, `note`, `tip`, `figure`, `quote`,
`cta`, `highlight`. **Aucune n'est un `leaf`**, et c'est la contrainte qui garde le sérialiseur HTML
purement générique — sans table de structures par directive.

Le critère qui la tient :

> **Si Markdown sait produire le contenu, on enveloppe. Sinon, c'est un `leaf`.**

Une image, un lien, du texte : Markdown les produit. Une vidéo intégrée, une iframe : non — ce sera
un `leaf`, il exigera que le rendu connaisse sa structure, et ce sera pour plus tard.

Tout le reste traverse **sans validation ni garantie de style**. On ne valide que ce qu'on garantit :
une V1 qui refuserait les directives du dev offrirait moins que le HTML, et le choix de Markdown ne
se défendrait plus.

## Deux sorties, et laquelle est le contrat

`proseToHtml` est une **commodité** : elle rend tout le noyau et porte la prévisualisation de
l'administration. Mais une directive du dev qui doit produire de la **structure** — un média, une
iframe — passe par l'arbre, puisqu'on ne fabrique pas un `<img>` en CSS.

Le rendu par le HTML impose aussi `v-html` / `set:html`, sort les liens internes du routeur et perd
l'optimisation d'images. **L'arbre est donc le contrat**, le HTML le raccourci.

## La sécurité tient à trois choses, toutes testées

1. **Le HTML brut est refusé à l'entrée** — un `<script>` ressort en texte.
2. **Les URL sont filtrées** — désactiver le HTML n'arrête pas `[clic](javascript:alert(1))`. Seuls
   `http`, `https`, `mailto`, `tel` et le relatif passent ; la casse et les caractères de contrôle ne
   masquent pas un schéma. Une URL refusée fait perdre son `href` au lien, qui reste **inerte et
   visible** plutôt que redirigé ailleurs.
3. **Les noms d'attributs sont filtrés** — ils viennent du texte, donc de n'importe où, et le préfixe
   `data-` n'y suffirait pas : c'est le nom lui-même qui doit être inerte.

## Les trois formes d'une directive

```md
:::warning        un corps de prose        → enveloppe
Retours sous 14 jours.
:::

::figure[Légende]{src=…}                   → média, un label et des attributs

Un mot :highlight[mis en avant].           → inline, au fil de la phrase
```

Une directive **crée** un nœud, elle n'en décore pas un qui existe. Pour qu'un lien ait l'allure d'un
bouton, on l'enveloppe — et le lien reste un vrai lien Markdown, cliquable partout :

```md
:::cta
[Nous contacter](/contact)
:::
```
