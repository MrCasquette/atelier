# ADR-0061 — La prose déclare ses directives, l'outil reste remplaçable

Statut : accepté · 2026-08-20
Portée : content

Précise [ADR-0030](./ADR-0030-texte-riche-markdown.md) — qui choisit Markdown — en tranchant ce
qu'elle laissait ouvert : **par quelle forme la prose porte ce que Markdown ne sait pas dire**, et
qui en décide. Elle en révise deux points, listés en fin de document.

## Contexte

ADR-0030 a choisi Markdown le 1er août 2026. Trois semaines plus tard, l'état du dépôt dit que la
décision n'a jamais été mise à l'épreuve :

| Constat | Trace |
|---|---|
| `richText` n'est contraint par rien | `t.String()` — `packages/fields/src/compile.ts:54` |
| Aucun contenu n'est en HTML | `types.ts:33` dit déjà « stockage Markdown » |
| Le seul HTML du dépôt n'est pas un `richText` | `product.description`, colonne du catalogue |
| Ce HTML n'est **rendu nulle part** | le store échappe : `{product.description}` |
| Aucune dépendance Markdown | ni `marked`, ni `remark`, ni `markdown-it` |

Le vecteur de XSS stocké qu'ADR-0030 voulait fermer par construction est effectivement fermé — mais
par **absence de rendu**, pas par le format. Rien n'est engagé, aucune donnée n'est écrite : c'est le
dernier moment où le choix coûte zéro.

Et deux des quatre arguments porteurs d'ADR-0030 se sont affaiblis à l'examen :

- **« lisible partout »** — vrai du Markdown nu, faux dès qu'on y ajoute une syntaxe d'annotation ;
- **« diff / revue »** — non pertinent : la prose vit en base, éditée par l'administration. On ne la
  diffe jamais.

Restent les deux qui portent réellement la décision, et qui n'ont pas bougé : **aucun sanitizer à
maintenir**, et **la donnée reste du texte**.

## Le besoin, tel qu'il se formule

> Écrire, formater et stocker du texte en faisant naviguer toute l'information de sa forme, de
> l'éditeur à la base, puis de la base au front qui la rend.

Markdown nu ne suffit pas : un avertissement, une citation attribuée, une image légendée, un lien qui
doit avoir l'allure d'un bouton n'ont aucune notation. ADR-0030 les renvoyait aux sections du page
builder. **C'est une erreur de frontière**, et elle se corrige ici :

> **Une section est un bloc de la page. Une directive est une inflexion du fil.**

Une galerie autonome entre deux paragraphes est une section. Une image légendée *au milieu d'un
article* est de la prose — la section, ce serait l'article entier. Découper un article en douze
sections pour y loger trois encadrés, c'est se servir d'un page builder comme d'un traitement de
texte, et cela n'a pas d'échelle : personne ne construit des sections sur mesure par article.

## Options envisagées

| | Souveraineté | Sécurité | Richesse | Coût |
|---|---|---|---|---|
| Markdown nu, le reste en sections | ✅ | ✅ | ❌ ne passe pas l'échelle | ✅ nul |
| Markdown + attributs (`{role=…}`) | ⚠️ annote, ne crée pas | ✅ | ⚠️ partielle | ⚠️ |
| **Markdown + directives (`:::`)** | ✅ | ✅ | ✅ | ⚠️ borné |
| Arbre JSON (Portable Text, Lexical) | ❌ propriétaire de fait | ✅ | ✅ | ✅ |
| HTML | ❌ | ❌ sanitizer éternel | ✅ | ⚠️ |
| Liquid, Twig | ❌ | ❌ **SSTI** | ✅ | ❌ |
| MDX | ❌ | ❌ compile en JavaScript | ✅ | ❌ |
| AsciiDoc | ✅ | ✅ | ✅ natif | ❌ `asciidoctor.js`, port Opal |
| DSL et parseur entièrement maison | ✅ | ✅ | ✅ | ❌ CommonMark est une spécification |

Trois écartées pour la même raison de fond, et elle mérite d'être nommée : **Liquid, Twig et MDX sont
exécutables.** Stocker de l'exécutable dans un champ éditable par un administrateur ouvre une classe
de vulnérabilité plus grave que le XSS visé par ADR-0030. Shopify emploie Liquid pour ses *thèmes*,
jamais pour le corps d'un article : cette frontière n'est pas un hasard.

L'arbre JSON est le choix du haut de gamme — Sanity, Contentful, Payload. Il est plus expressif et
moins cher à mettre en œuvre. Il perd la seule chose qu'on ne peut pas racheter : un fichier texte se
relit dans trente ans, un arbre propriétaire meurt avec le code qui lui donnait sens.

Les attributs sur nœud existant sont écartés sur un fait vérifié le 20 août 2026 : **`remark-attr`
n'a pas été publié depuis mai 2022** et dépend de `remark-footnotes@1`, incompatible avec unified 11.
Surtout, un attribut ne peut qu'*annoter* un nœud — jamais en créer un. Il ne sait donc pas dire
l'image légendée, qui est précisément ce qui manque.

## Décision

### 1. Markdown, avec les directives pour forme

La syntaxe `:::` — conteneur, leaf, inline — porte ce que Markdown ne dit pas :

```md
:::warning
Retours acceptés sous 14 jours.
:::

::figure[Le comptoir en 1921]{src=…}

Un lien qui a l'allure d'un bouton : :button[Nous contacter]{href=/contact}
```

Ce n'est pas une invention : Docusaurus et VitePress l'emploient, GitHub a ses alertes, Obsidian ses
callouts. C'est une convention de fait qu'une bonne moitié de l'outillage reconnaît.

Elle remplace la notation `{role=button}` qu'ADR-0030 donnait en exemple, pour une raison
fonctionnelle et non esthétique : **trois formes pour trois besoins**, là où l'attribut n'en couvrait
qu'un.

### 2. On n'annote pas un nœud, on l'enveloppe

Une directive **crée** un nœud ; elle n'en décore pas un qui existe. Pour qu'un lien ait l'allure
d'un bouton, on l'entoure au lieu de lui coller un attribut :

```md
:::cta
[Nous contacter](/contact)
:::
```

Le lien reste un **vrai lien Markdown**. Un outil qui ignore `:::` affiche trois deux-points et un
lien parfaitement cliquable — là où `:button[Nous contacter]{href=/contact}` l'aurait détruit en
transformant son URL en attribut. Au fil d'une phrase, la forme inline fait de même :
`:highlight[ce mot]` enveloppe sans rien casser.

**Un seul mécanisme, trois formes.** Pas de second système d'attributs à écrire, valider et
documenter — d'autant que l'écosystème vivant ne le fournit plus.

Ce que la règle coûte : c'est plus verbeux qu'un suffixe en fin de ligne. Ce qu'elle achète : le
contenu ne perd jamais sa lisibilité de Markdown.

### 3. La prose n'est pas une page : un axe propre

> **Une section divise une page. Une prose est un tout cohérent qu'on veut formater.**

C'est pourquoi une directive n'est **pas** un troisième `DefinitionRole`. Une section est une
**division** — elle a un identifiant, une position, un statut, elle existe seule. Une directive est
une **inflexion à l'intérieur d'un tout indivis** : elle n'a aucune existence hors du texte qui la
contient.

Elle porte donc son propre `kind: 'directive'`, à côté de `'definition'` et `'entity'`, accueilli
par `defineContent` dans son propre champ. Le précédent est écrit dans le dépôt, au-dessus des
entités : « **même grammaire de champs, autre nature, autre stockage** ».

**Le verbe est `defineDirective`** — nu, comme `defineSection`, `defineComponent` et `defineEntity`,
dont aucun ne porte de préfixe. `defineProse` a été écarté après coup : la prose est une **matière**,
pas un objet dénombrable — c'est d'ailleurs l'argument qui justifie le singulier du paquet au §10. On
ne définit pas *une* prose.

**Les directives n'empruntent rien au modèle des sections** — pas même le vocabulaire des attributs.
Le rapprochement était tentant, la forme se ressemblant (un nom, des attributs), mais le décompte le
défait : sur les douze `kind` de `@repo/fields`, une directive en emploierait trois, et de travers.
`list`, `repeater`, `component`, `ref`, `enum multiple` n'ont aucun sens dans une chaîne de
caractères. Il n'y a **pas de formulaire à générer**, et **rien à inférer** — un attribut de directive
est une `string`, toujours.

Deux différences structurelles achèvent la séparation :

- **les attributs d'une directive sont toujours des chaînes**, parsées depuis du texte : `{count=3}`
  arrive en `"3"`, quand la donnée d'une section est du JSON déjà typé ;
- **une directive conteneur a un corps, et ce corps est de la prose** — des paragraphes, d'autres
  directives. Un modèle de champs décrit des champs, pas une récursion sur l'arbre de texte. Une
  section n'a pas de notion de corps.

`@repo/prose` porte donc son propre modèle d'attribut, et il tient en trois informations : quels
attributs existent, lesquels sont requis, et parfois un format à vérifier.

```ts
defineDirective('figure', {
  shape: 'leaf',
  attributes: { src: { required: true, format: 'uuid' }, caption: {} },
});
```

L'existence réelle du média se vérifie ailleurs, comme elle l'est déjà pour les sections : le
validateur de forme ne consulte pas la base.

Conséquence heureuse : **`@repo/prose` n'a aucune dépendance interne** — ni `@repo/db`, ni
`@repo/fields`. Du texte en entrée, un arbre en sortie. Ce qui reste du parallèle avec `defineEntity`
est seulement la **place du verbe**, pas le partage d'un modèle.

**Rien ne va en base.** Une directive est déclarative de bout en bout : elle ne crée pas de table et
n'y range aucune ligne. Le **noyau** vit dans `@repo/prose`, donc l'API et l'administration le
connaissent sans rien stocker ; les **directives du dev** vivent dans son front, seul à devoir les
rendre. Pas de table, pas de poussée, pas de cache à invalider.

Le coût assumé : l'administration ne saura pas prévisualiser une directive du dev — elle s'affichera
brute. C'est exactement cohérent avec le §4, et réversible sans migration.

### 4. Déclaré vaut garanti ; inconnu voyage structuré

- **Directive déclarée** — validée, attributs compris, et **garantie dessinée par nos thèmes**.
- **Directive inconnue** — traversée sans validation ni garantie de style.

« Sans garantie » ne veut pas dire « en vrac ». Le parseur reconnaît la **syntaxe** universellement ;
ce qu'il ignore, c'est le **nom**. Une directive inconnue arrive donc au front **structurée** comme
une autre — `{ name, attributes, children }` — et sort en `data-directive="…"`. Le dev n'a donc rien à
re-parser. Sans cela on aurait un format à deux vitesses, dont personne n'emprunterait la seconde.

Ce qu'il lui reste à faire dépend de ce que sa directive doit **produire**, et la nuance est réelle :
une directive **enveloppe** se style en CSS seul ; une directive qui doit produire de la
**structure** — un média, une iframe — exige de consommer l'arbre, puisqu'on ne crée pas un `<img>`
en CSS.

Tant qu'aucun thème n'existe, la différence entre noyau et directive du dev n'est d'ailleurs pas le
style : c'est la **validation**.

La fermeture est écartée pour un motif de fond : une V1 qui offrirait *moins* que le HTML ferait
d'ADR-0030 une régression immédiate contre un bénéfice différé. Le choix de Markdown ne se
défendrait plus.

Et il n'y a **jamais de fermeture prévue**. Ce qui vient plus tard n'ouvre rien : cela **ajoute des
garanties**. Un contenu écrit aujourd'hui reste valide quand un thème déclare enfin sa directive ; il
devient seulement garanti. Le passage est **monotone**, donc sans rupture — alors que fermer une
liste après coup en aurait produit une, certaine.

Ce qui est fermé, c'est **le noyau** : une directive du noyau ne se redéfinit pas. Même idiome que
l'espace `/-/` d'[ADR-0052](./ADR-0052-surfaces-exploitation-image-unique.md) — la collision devient
impossible au lieu d'être improbable.

### 5. La sortie porte des `data-*`, jamais des classes

Une directive rend son nom et ses attributs en `data-*` — `data-directive="warning"`. Le mot `role`
est écarté : il est déjà pris deux fois, par le RBAC (`Role`, `administratorRoleId`) et par
`DefinitionRole`. Une classe, elle, est structurellement capable de porter
`class="text-red-500 font-bold"` ; un `data-*` ne l'est pas — personne n'en aura le réflexe, et un
essai ne stylerait rien puisque Tailwind ne scanne pas la base. **La règle d'ADR-0030 §1 — intention,
jamais présentation — est ainsi tenue par la forme plutôt que par la discipline**, comme `@repo/db`
absent du manifeste de `pages-registry` rend l'import irrésolvable au lieu de le déconseiller.

Corollaire pour les thèmes : les directives se stylent en CSS dédié
(`[data-directive='warning'] { … }`), pas en utilitaires générés.

### 6. Une directive se classe par ce qu'elle produit, et l'arbre est le contrat

Ce qui a besoin d'être classé n'est ni le thème ni la sémantique, mais **ce que la directive doit
produire en HTML** — c'est cet axe qui structure la documentation, le sérialiseur et le renderer du
dev :

| | Produit | Rendu générique ? | Exemples |
|---|---|---|---|
| **Enveloppe** | un conteneur autour de ses enfants | ✅ | `warning`, `note`, `cta`, `quote` |
| **Média** | un élément vide à attributs (`<img>`, `<iframe>`) | ❌ | `figure` |
| **Inline** | un élément inline portant son label | ❌ | `highlight` |

D'où : **le sérialiseur HTML n'est pas purement générique.** Il connaît la structure de chaque
directive du noyau — `figure` sort `<figure><img><figcaption>`, pas un `<div>` à data-attributs — et
ne retombe sur le rendu générique que pour les enveloppes et pour l'inconnu.

**Deux sorties, et une hiérarchie explicite : l'arbre est le contrat, le HTML une commodité.**

| | HTML `data-directive` | Arbre |
|---|---|---|
| Coût pour le dev | nul, du CSS | un renderer |
| Custom enveloppe | ✅ | ✅ |
| Custom structurel | ❌ | ✅ |
| Composants, liens routés, images optimisées | ❌ | ✅ |
| `v-html` / `set:html` | requis | jamais |

L'arbre est le contrat parce qu'il peut tout exprimer et s'enrichir sans rompre, quand le HTML est
plat ; parce qu'il évite `v-html`, dont le dépôt fait par ailleurs un signal de sécurité ; et parce
que sans lui, un `:::video{id=…}` déclaré par un dev serait irrécupérable.

Le HTML reste fourni parce qu'il rend **tout le noyau** correctement, qu'il rend une directive
custom d'enveloppe gratuite, et parce que la **prévisualisation de l'administration** en a besoin —
là, le contenu vient de l'éditeur lui-même, et le `v-html` est sans risque comme sans alternative
raisonnable.

**Les familles sont écartées.** Elles avaient servi à raisonner sur le coût pour les thèmes — ouvrir
une famille coûte, ajouter une variante presque pas — et elles restent utiles à ce titre pour décider
quoi admettre au noyau. Mais une seule aurait plusieurs membres (`warning`, `note`, `tip`) ; les
autres sont des singletons déguisés en taxonomie, et un sélecteur CSS groupé suffit à la seule vraie.
Ce qu'elles auraient acheté — un thème sachant dessiner une directive inconnue d'après sa famille —
reste ajoutable plus tard sans rupture, comme tout le reste de ce modèle.

### 7. HTML inline désactivé — non négociable

Le parseur refuse le HTML brut dans le Markdown. Sans cela, la sortie n'est plus close et tout le
raisonnement de sécurité s'effondre : c'est l'entrée qui rend la sortie sûre.

### 8. L'arbre est le nôtre, éphémère, et l'outil est un détail

Le parseur traduit **immédiatement** vers un arbre défini ici. `mdast` n'est jamais exposé, pas plus
que ne l'auraient été les tokens de markdown-it.

**Cet arbre est éphémère.** Il est reconstruit à chaque rendu et n'est stocké nulle part — la base ne
contient que du texte, octet pour octet celui qui a été écrit. C'est ce qui sépare notre modèle d'un
*Portable Text*, où l'arbre **est** la source de vérité : un HTML devient lui aussi un arbre DOM dès
qu'un navigateur le lit, sans que personne n'appelle HTML un format d'arbre.

C'est aussi par là que le chantier pourrait se trahir : **cacher l'arbre en base « pour la
performance » nous ramènerait à Portable Text par la porte de derrière**, avec deux sources de vérité
au lieu d'une. Le parseur est une bibliothèque, jamais un service : il s'exécute là où le rendu se
fait — au build pour une vitrine Astro, côté serveur pour un front dynamique, dans l'administration
pour la prévisualisation. La raison est celle qui a déjà fait importer TypeBox
*depuis Elysia* : ne pas faire dépendre notre contrat public des versions d'un tiers.

Et c'est ce qui neutralise le risque d'un outil abandonné : **la donnée stockée est du texte.** Si
l'extension de directives meurt, on en réécrit une — aucune donnée ne bouge, aucune migration. C'est
exactement ce qu'un arbre JSON propriétaire ne peut pas offrir.

Amorce d'implémentation : `mdast-util-from-markdown` avec l'extension de directives, tous deux
vivants au 20 août 2026 (publiés en février 2026 et février 2025). L'écosystème micromark compte
beaucoup de paquets mais **~242 Ko publiés**, contre ~2,38 Mo pour `markdown-it` et son greffon
d'attributs.

### 9. L'éditeur sort du chemin critique

**V1 : le `<Textarea>` existant.** L'utilisateur avancé écrit la syntaxe.

Le problème le plus dur de ce domaine est **l'aller-retour** : un éditeur visuel qui parse puis
resérialise perd du formatage, normalise sans qu'on l'ait demandé, efface la syntaxe qu'il ignore.
ADR-0030 en croisait déjà un symptôme quand elle écartait le double espace, qui ne survit pas à un
`trim()`. Si la surface d'édition est du texte, **il n'y a pas d'aller-retour du tout.**

La cible n'est donc pas un éditeur visuel à nœuds sur mesure, mais **source plus prévisualisation** —
le modèle de GitHub et de StackOverflow. Deux vues exclusives, la source restant l'unique vérité :

- la prévisualisation est **gratuite** : c'est le rendu de production, écrit de toute façon ;
- elle est **exacte**, puisqu'elle peut charger le CSS du thème — là où un éditeur visuel montre
  toujours *son* style et jamais celui du site.

Un bouton n'a plus qu'à insérer du texte au curseur.

Rien de tout ceci n'est décidé ici : **le format ne dépendant pas de l'éditeur, l'éditeur s'améliore
sans jamais migrer une donnée.**

### 10. `@repo/prose`

La logique — parseur, arbre, validation, sérialisation HTML — vit dans **`@repo/prose`**. Le
vocabulaire d'authoring rejoint `@mrcasquette/content`, à côté de `defineSection`. C'est le partage
déjà retenu pour les pages par [ADR-0059](./ADR-0059-nom-nu-et-prefixe-de-scission.md).

C'est du contenu et non du commerce : paquet partagé, par la règle de placement
d'[ADR-0058](./ADR-0058-fraternite-des-produits.md).

Le singulier ne déroge à rien. Le dépôt met au pluriel les **collections d'objets nommés** —
`fields`, `pages`, `menus`, `entities`, `references`, `adapters`, `assets` — et au singulier les
**matières ou capacités** : `auth`, `identity`, `communication`, `content`, `db`. La prose est une
matière.

Écartés : **`@repo/markdown`** nomme l'outil et non le concept, alors que le §8 vient précisément de
rendre l'outil remplaçable — le nom mentirait au premier changement. **`@repo/richtext`** reprend le
nom du `kind`, mais « rich text » ne désigne rien de précis et ferait écho à `RichTextEditor.vue`,
qui est justement ce dont on se passe.

## Ce que cet ADR révise dans ADR-0030

1. **La notation.** `{role=button}` devient `:::` — un attribut annote, il ne crée pas de nœud.
2. **La frontière prose / section.** « Un encadré, une image légendée relèvent d'une section »
   devient : *une section est un bloc de la page, une directive est une inflexion du fil.*

Tout le reste tient : Markdown, l'intention plutôt que la présentation, l'antislash pour le saut dur,
`breaks: true` écarté, aucun sanitizer.

## Conséquences

- **`richText` cesse d'être un `t.String()` nu.** La validation porte sur les directives du noyau.
- **TipTap perd sa raison d'être.** Un seul appelant dans tout le dépôt — `ProductInfoCard.vue:30` —
  pour un HTML que rien ne rend. Le coût de sortie ne sera jamais plus bas qu'aujourd'hui.
- **`product.description` reste à traiter** : colonne du catalogue hors du modèle de champs, remplie
  d'un HTML que le store affiche échappé, balises comprises. Convertir ou repartir de zéro est une
  décision distincte, à prendre sur la donnée réelle.
- **Le public est un choix, pas une découverte.** Tant que l'éditeur ne met pas en forme, quelqu'un
  tape `:::warning` à la main. Sans objet pour un intégrateur, friction réelle pour le gérant d'une
  boutique qui édite ses conditions de vente. Acceptable en V1, et améliorable sans migration.
- **Une garde manque, et elle est nommée** : rien n'empêcherait de stocker l'arbre à côté du texte.
  C'est la seule dérive qui détruirait la thèse de cet ADR sans qu'aucun test ne tombe.
- **Rien de tout ceci n'est gardé.** Aucune garde ne vérifie qu'une directive du noyau n'est pas redéfinie,
  ni qu'un paquet partagé n'émet pas de `class`. À inscrire au backlog plutôt qu'à supposer.
- **La position différenciante est formulable** : la richesse d'un *Portable Text* avec la
  souveraineté d'un fichier texte. Strapi et Directus offrent du HTML ou du Markdown nu avec des
  classes libres ; Sanity, Contentful et Payload offrent un arbre propriétaire. Personne ne tient les
  deux bouts.
