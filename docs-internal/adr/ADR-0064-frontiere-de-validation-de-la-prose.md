# ADR-0064 — La prose se corrige à l'édition, elle ne se refuse pas à l'écriture

Statut : accepté · 2026-08-24
Portée : content

Révise **une conséquence** d'[ADR-0061](./ADR-0061-prose-directives-declarees.md) : *« `richText`
cesse d'être un `t.String()` nu. La validation porte sur les directives du noyau. »* La seconde
phrase tient — c'est bien le noyau qu'on valide. La première tombe : la validation n'a pas lieu à la
frontière d'écriture. Tout le reste d'ADR-0061 est intact, le noyau fermé et l'arbre-contrat compris.

## Contexte

ADR-0061 a été acceptée le 20 août 2026. Le moteur a été écrit dans la foulée — parseur, arbre,
noyau, validation par constats, sérialiseur HTML — et **n'a été branché nulle part**. Quatre jours
plus tard, au moment de le brancher, la question s'est posée pour de bon : *sous quelle forme*
`richText` cesse-t-il d'être un `t.String()` nu.

Deux formes se présentaient. Un **format TypeBox** — `t.String({ format: 'prose' })`, enregistré sur
l'instance d'Elysia à côté d'`uuid` et de `date` : une ligne, sur le chemin de validation existant,
donc couvrant tous les points d'écriture présents et à venir. Ou une **passe de constats** à côté de
`duplicateFieldNames` et `unresolvedComponents`, câblée à la main aux deux points d'écriture qui
valident de la donnée de champ (`pages-registry/registry.ts`, `entities/write-service.ts`).

Le format l'emportait sur le critère habituel du dépôt — une garantie tenue par la forme vaut mieux
qu'une garantie tenue par la discipline. **C'était le mauvais critère**, parce qu'il supposait
résolue la question qui ne l'était pas.

## Ce qui a retourné la décision

**Un format TypeBox parse l'arbre pour rendre un booléen.** Il produit exactement l'information qui
manque — quelle directive, quel attribut, quelle forme — et la jette. Pour expliquer quoi que ce
soit, il faut re-parser ailleurs.

Le format n'est donc pas « pas cher ». Il est pas cher **à condition de renoncer définitivement à
expliquer**. Or on n'y renonce pas : la prévisualisation parse déjà (§9), et des boutons de
raccourci font de l'éditeur une surface qui connaît les directives. Le chemin qui comprend l'arbre
va exister de toute façon. Une fois qu'il existe, le format est soit redondant, soit un second parse.

Ce constat en a découvert un plus large : **le refus d'écriture ne protège rien.**

| | |
|---|---|
| Au repos | la base stocke le texte source octet pour octet (§8) — une directive fautive ne corrompt aucune donnée |
| Au rendu | `proseToHtml` est sûr par construction — HTML coupé au tokenizer, URL filtrées, noms d'attributs inertes (§7) |
| En aval | rien ne consomme la structure d'une directive : elle sort en `data-directive`, stylée ou non |

Et la surface de faute est étroite. `proseIssues` ne produit trois constats que sur les **sept
directives du noyau** — une directive inconnue traverse sans validation, par ADR-0061 §4. Dans
`CORE_DIRECTIVES`, un seul attribut existe (`quote.author`) et il n'est pas requis : `missing_attribute`
est aujourd'hui **injoignable**. Il reste `:::warning{foo=1}` et `::warning` écrit en leaf.

Un 400 sur ces deux cas refuserait **un brouillon** pour un défaut cosmétique — à quelqu'un qui rédige
ses conditions de vente, et qui n'a pas d'autre endroit où mettre son texte en attendant.

## Décision

### 1. L'API n'oppose aucun refus à un `richText`

`compile.ts` continue de rendre `t.String()` pour le `kind: 'richText'`. Aucun format n'est
enregistré, aucune passe de constats n'est câblée aux chemins d'écriture.

Ce n'est pas un trou dans la frontière : c'est la reconnaissance qu'**un champ de prose est un champ
de texte**, et qu'il n'y a rien de plus à en garantir. La frontière garantit ce dont la suite dépend
— une longueur, un UUID, un format de date. Rien ne dépend de la bonne écriture d'un `:::warning`.

### 2. Les constats vont là où ils sont actionnables

`proseIssues` et `describeIssue` — écrits par ADR-0061 pour rendre des constats plutôt que jeter —
sont servis à **la surface d'édition**, sous le champ, à la personne qui tient le texte sous les yeux
et peut le corriger dans la seconde.

C'est le seul endroit où un constat sur de la prose a un destinataire. Dans un corps de réponse HTTP,
il n'en a pas : ni la CLI qui pousse un registre, ni un appel d'intégration ne savent quoi faire de
« *« quote » ne connaît pas l'attribut « foo »* ».

### 3. Un seul parse sert les trois usages

```
parseProse(source) ─┬─→ proseToHtml()  →  l'aperçu
                    ├─→ proseIssues()  →  les constats sous le champ
                    └─→ (à venir)      →  ce que les boutons savent insérer
```

C'est le §9 d'ADR-0061 tenu à la lettre — *« la prévisualisation est gratuite : c'est le rendu de
production »* — et étendu d'un cran : **la validation vient avec l'aperçu, sans rien coûter de plus.**
C'est ce qui rend la décision économique en plus d'être juste.

### 4. Ce que ça défait dans le graphe de dépendances

`@repo/fields` **n'a pas à dépendre** de `@axiome-apps/atelier-prose`. Les ~242 Ko de l'écosystème
micromark n'entrent pas dans le chemin de validation de l'API, et la grammaire des champs reste ce
qu'elle dit être : *ce qu'un champ est, ce qu'il accepte* — sans savoir lire du Markdown.

C'est un gain net, et il n'était pas cherché. Il confirme la décision plus qu'il ne la motive.

## Ce qui a été écarté

**Le format TypeBox `prose`** — défait ci-dessus. Il mérite d'être noté plutôt qu'oublié : il était le
choix conforme à l'habitude du dépôt (*la forme plutôt que la discipline*), et c'est ce qui l'a rendu
tentant pendant une heure. L'habitude était bonne, le cas ne s'y prêtait pas — elle vaut pour une
garantie dont quelque chose dépend, pas pour un message qu'on ne saurait pas afficher.

**La passe de constats à la frontière** (`proseFaults` câblé aux deux chemins d'écriture). Elle
rendait de bons messages, mais au mauvais destinataire, et au prix d'une garantie tenue par la
discipline : un troisième chemin d'écriture n'aurait rien validé, et aucun test ne serait tombé. On ne
paye pas ce prix-là pour un message que personne ne lit.

**Valider au push de registre plutôt qu'à l'écriture.** Sans objet : un registre déclare des
**champs**, pas des valeurs. La prose n'y passe jamais.

## Conséquences

- **La surface d'édition devient le cœur du chantier de branchement**, là où elle en était
  l'accessoire — ADR-0061 §9 écrivait que *« l'éditeur sort du chemin critique »*. C'était vrai de
  l'éditeur **visuel**, qui reste écarté ; ça ne l'est plus de la surface source + aperçu, qui porte
  désormais aussi les constats.
- **Une garantie de moins tenue par la forme, et elle est nommée** : rien n'empêche d'écrire un
  `:::warning{foo=1}` par l'API. C'est assumé, et c'est sans conséquence — mais quelqu'un le
  redécouvrira, et cet ADR est là pour qu'il n'en refasse pas l'instruction.
- **Le jour où ça changerait** : si une directive du noyau gagne un attribut **requis**, ou si un
  `leaf` y entre — deux cas où une faute cesse d'être cosmétique et devient une structure manquante
  au rendu —, la question se rouvre. La passe de constats se rajoute alors **par-dessus**, sans rien
  défaire de ce qui est écrit ici.
- **ADR-0061 n'est pas amendée.** Un ADR est un journal ([ADR-0060](./ADR-0060-natures-de-la-documentation.md)) :
  sa conséquence n°1 reste écrite telle qu'elle a été pensée le 20 août, et c'est ce document qui dit
  ce qu'elle est devenue.
