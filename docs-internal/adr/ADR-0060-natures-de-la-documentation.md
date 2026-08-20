# ADR-0060 — La documentation a cinq natures, l'ADR n'en est qu'une

Statut : accepté · 2026-08-20
Portée : socle

Précise [ADR-0024](./ADR-0024-portee-adr.md) — qui pose le compteur unique et le champ de portée — en
disant ce qu'un ADR **n'est pas**, et où va ce qu'il ne doit pas porter.

## Contexte

Le corpus s'est déséquilibré au point que la mesure suffit à faire le diagnostic :

| Mesure | Valeur |
|---|---|
| ADR | 59 fichiers, **6 207 lignes** |
| Document d'architecture | `reference/architecture.md`, **77 lignes** |
| Le plus gros ADR | ADR-0050, **1 099 lignes** |
| ADR amendés en place | **13**, dont ADR-0033 et ADR-0038 trois fois chacun |
| Fichiers `roadmap` | **4**, dont un index et une roadmap publique — hiérarchie assumée, pas duplication |
| Fichiers `api-keys.md` | **2** — `reference/` et `docs/dev/` |

L'état courant du système tient sur deux écrans, l'historique des décisions sur cent. Et
`architecture.md` s'intitule « Architecture **Échoppe** » : il ne couvre même pas les deux produits.

### Le diagnostic n'est pas « il manque des dossiers »

Presque toutes les natures existent déjà — `adr/`, `reference/`, `design/`, `release/`, `docs/`,
plus les README de paquets. Ce qui manque est ailleurs, et se voit à trois symptômes :

- **Un ADR de 1 099 lignes n'est plus un ADR.** ADR-0050 porte un contrat de faute complet, des
  tables par statut HTTP, des notes d'implémentation. C'est de la référence, écrite là faute d'un
  autre endroit. Même mouvement, moindre degré, pour ADR-0047 (264), ADR-0042 (246), ADR-0038 (223).
- **Un ADR qui contient un chemin pourrit.** ADR-0011 décrivait `packages/core/src/adapters/` trois
  semaines après la disparition de ce dossier. Silencieusement : rien ne pouvait le contredire.
- **Une vérité structurante enfouie est introuvable.** ADR-0050 énonçait « Échoppe est
  conceptuellement Prisme plus le commerce » — la thèse d'[ADR-0058](./ADR-0058-fraternite-des-produits.md) —
  rangée sous une décision qui parle d'exceptions HTTP. Personne ne va l'y chercher, et il a fallu la
  réécrire quatre jours plus tard.

Les ADR ont joué un rôle qui n'est pas le leur **parce qu'il n'y avait pas d'alternative**. La cure
n'est donc pas de les corriger : c'est de créer l'alternative.

## Décision

### 1. Cinq natures, et une chaîne de dérivation

| Nature | Rôle | Où |
|---|---|---|
| **ADR** | tranche — pourquoi cette architecture existe | `docs-internal/adr/` |
| **Architecture** | décrit — quelle est cette architecture aujourd'hui | `docs-internal/architecture/` |
| **Conventions** | prescrit — comment on écrit du code ici | `docs-internal/conventions.md` |
| **Glossaire** | nomme — le vocabulaire et la grammaire du dépôt | `docs-internal/glossaire.md` |
| **Runbook** | exploite — déployer, diagnostiquer, restaurer | `docs-internal/runbook/` |

```
ADR ─────────► Architecture ─────────► Conventions · Glossaire · Runbook
tranche        décrit l'état courant    prescrivent, nomment, exploitent
```

**C'est un ordre de dérivation, pas un ordre chronologique.** L'information remonte aussi souvent
qu'elle descend : on constate une dérive dans le code, on corrige l'architecture, et cela révèle
qu'une décision est morte — donc un ADR. ADR-0058 et ADR-0059 sont nés d'un `import` gênant dans un
fichier de test, pas d'une proposition écrite.

**Pas d'étage RFC.** Un processus de proposition écrite existe pour coordonner des gens qui ne sont
pas dans la même pièce. Ici, la méthode de travail — question, explication, réponse construite à
deux, ADR — en tient lieu, et la section « Options envisagées » de l'ADR en recueille le résultat.
Un document de proposition ne serait qu'un brouillon recopié.

### 2. L'ADR est un journal, et il ne se réécrit pas

Trois cas, et trois seulement :

| Cas | Traitement |
|---|---|
| Coquille, lien mort, formulation | modification du fichier |
| Clarification qui ne change pas la décision | modification du fichier |
| Nouvelle décision, changement de portée, conséquence structurante | **nouvel ADR** |

**Le test pour trancher entre les deux derniers : est-ce que la modification changerait ce que
quelqu'un fait ?** Si oui, c'est une décision, donc un nouvel ADR — même si la formulation paraît
mineure. Sinon, c'est une clarification.

**Plus d'amendement in-fichier.** La pratique a produit des ADR qui ne sont plus des instantanés
datés sans devenir pour autant une référence fiable. Les amendements déjà écrits restent : ils font
partie du journal.

**Trois statuts de relation, fermés** — le vocabulaire flottant (« amendé », « partiellement
amendé ») disparaît avec la pratique qui l'a produit :

- **précisé par `NNNN`** — la décision tient, sa portée s'étend ;
- **remplacé par `NNNN`** — la décision est morte ;
- **déprécié** — la décision n'a plus d'objet, rien ne la remplace.

### 3. Un ADR parle au passé daté

Il **peut** montrer une arborescence, un chemin, une liste de paquets : souvent c'est la photographie
qui rend la décision compréhensible, et l'amputer appauvrirait le journal. Ce qu'il ne peut pas
faire, c'est **prétendre au présent**.

Le défaut est grammatical. ADR-0011 n'était pas fautif de citer un chemin, il était fautif d'écrire
« structure uniforme sous `packages/core/src/adapters/<famille>/` » — un présent normatif, qui dit
comment c'est et non ce qu'on a décidé ce jour-là. Trois semaines plus tard le dossier n'existait
plus, et la phrase envoyait toujours au mauvais endroit.

**Le test : un lecteur pourrait-il agir sur cette information en la croyant vraie aujourd'hui ?** Si
oui, elle se date explicitement (« à cette date, X vivait en Y ») ou elle sort. Ce qui décrit l'état
courant **pour qu'on s'en serve** appartient à l'architecture, qui se met à jour.

### 4. L'architecture est vivante, et vérifiable

Elle se **remplace**, jamais ne s'amende : git porte son historique, les ADR portent le pourquoi.
Elle décrit l'état courant sans le justifier — elle cite l'ADR qui a tranché.

**Ce qui est dérivable ET volatil doit être gardé** — et rien d'autre. C'est la seule protection
contre une doc qui ment avec autorité, mais la limite compte autant que le principe : gardé sans
frontière, il produirait une usine à tests documentaires, coûteuse et vite désactivée.

**Une affirmation est dérivable si sa négation est détectable sans jugement** : une commande rend un
verdict binaire, sans avoir à interpréter une intention. Cela ne suffit pas — beaucoup de choses
dérivables ne changent jamais, et les garder coûte sans rien acheter. D'où le second critère, la
**volatilité**.

|  | Volatil | Stable |
|---|---|---|
| **Dérivable** | **gardé** | vérification ponctuelle |
| **Non dérivable** | discipline humaine — voir ci-dessous | jamais gardé |

**Gardable**, et la liste s'arrête là : qu'un lien pointe vers un fichier existant ; qu'un chemin
cité dans `architecture/` existe ; que la liste des paquets d'`overview.md` corresponde aux paquets
découverts ; qu'une commande citée existe dans les `scripts` ; qu'une dépendance annoncée absente le
soit vraiment.

**Humain, définitivement** : pourquoi une frontière existe, ce qu'un paquet a le droit de faire, le
rapport entre les produits, ce qu'un mot veut dire, les responsabilités et les flux. Aucune commande
ne rend un verdict là-dessus ; une garde qui le prétendrait produirait du faux positif jusqu'à ce
qu'on la coupe.

**Le quadrant « non dérivable et volatil » est presque vide**, et c'est une information : une
affirmation qui change souvent porte presque toujours sur une structure, donc sur du dérivable. Quand
une page s'y aventure quand même, le signal n'est pas qu'il faut une garde — c'est que **cette phrase
n'a rien à faire là**.

### 5. Le test qui range entre architecture et le reste

> **L'architecture dit où une chose vit et pourquoi. Le reste dit ce qu'elle fait et comment
> l'appeler.**

Opérationnellement : si l'information change quand on **renomme ou déplace un paquet**, c'est de
l'architecture ; si elle change quand on **modifie une signature**, non — et alors elle vit dans le
README du paquet concerné, ou dans le contrat généré.

**Pas de dossier de référence par module.** `content-module.md`, `entites.md`, `interpolation.md`,
`api-keys.md` doublonnaient trois choses qui existent déjà : les types, l'OpenAPI dérivé du code, et
surtout le **README du paquet**, qu'`AGENTS.md` désigne déjà comme sa charte. Une doc de module tenue
loin de son module diverge.

### 6. Le glossaire ferme le vocabulaire

Il porte deux choses : le **vocabulaire métier** (page, section, définition, entité, principal,
surface…) et la **grammaire du dépôt** — ce qu'implique un scope, ce que signifie un préfixe de
paquet ([ADR-0059](./ADR-0059-nom-nu-et-prefixe-de-scission.md)), la nomenclature des dossiers et
des gardes.

Ce n'est pas un ornement. Quatre points de friction d'une seule session de travail étaient des
collisions de mots : « registry » désigne trois choses (registres npm, registre d'entités, registre
de définitions) ; « repository » se heurte au scope `@repo` ; « socle » désigne à la fois une portée
d'ADR et les paquets partagés ; « content » est pris par un paquet publié alors qu'il nomme aussi un
domaine. Chacune a coûté un aller-retour.

### 7. Ce qui n'est pas dans la chaîne

`backlog/` et `audits/` sont des **artefacts de travail** : datés, jetables, sans autorité. Les
laisser sans statut, c'est garantir qu'un audit finira par servir de référence.

### 8. La disposition

```
docs-internal/
  adr/                 journal des décisions
  architecture/        état courant
  conventions.md       comment on écrit ici
  glossaire.md         vocabulaire métier et grammaire du dépôt
  runbook/             exploitation
  backlog/  audits/    artefacts de travail
docs/                  documentation publique
racine                 README.md · AGENTS.md · ROADMAP.md · BACKLOG.md
```

`conventions.md` et `glossaire.md` restent **à plat** : un dossier pour un fichier n'apporte rien, et
conserver le nom `reference/` pour deux fichiers qui ne sont pas de la référence reconduirait
l'ambiguïté qu'on retire.

## Ce qui a été écarté

**Réécrire les ADR pour en retirer les amendements.** Un ADR ne vaut pas par son exactitude actuelle
— il vaut parce qu'il dit ce qu'on savait au moment de décider. Un corpus rétro-nettoyé donnerait
l'illusion d'une architecture pensée d'un bloc, et effacerait ce qu'on veut garder : qu'ADR-0034 se
soit trompé et qu'ADR-0040 l'ait corrigé est une information. Git ne la remplace pas — personne ne
fait d'archéologie git pour comprendre une décision.

**Un étage RFC obligatoire.** Cf. §1.

**arc42 ou C4 appliqués à la lettre.** Utiles comme liste de contrôle, mortels comme gabarit : on
obtient douze fichiers dont huit vides. Les pages d'architecture naissent d'un besoin réel, une par
une.

**Documenter chaque module.** Une doc interne documente ce qui n'est pas évident en lisant le code
localement : frontières, invariants, responsabilités, flux, raisons structurelles. Pas les
signatures.

## Conséquences

- **Redistribution avant suppression, jamais l'inverse** : `reference/` et `design/` portent ~2 300
  lignes dont une part n'existe nulle part ailleurs.
- `design/` disparaît, mais ce n'était pas un dossier de propositions : deux roadmaps deviennent
  `roadmap/`, quatre notes de fonctionnalités non faites rejoignent `backlog/`, et
  `perimetre-prisme.md` — un inventaire daté — rejoint `audits/`. **Six ADR et deux backlogs citent `design/`** — les ADR gardent leur lien,
  qui devient un lien vers un fichier déplacé : un journal ne se réécrit pas pour réparer un chemin.
- Les ADR obèses se dégonflent par **déménagement**, pas par réécriture : ce qui est de la référence
  part vers l'architecture, l'ADR garde sa décision et un renvoi. ADR-0050 rendrait à lui seul
  plusieurs centaines de lignes.
- La duplication mesurée se ferme : deux `api-keys.md` → un. Les quatre fichiers `roadmap`, eux,
  forment une hiérarchie voulue — index à la racine, deux roadmaps internes, une publique — et ne
  changent que d'adresse : `roadmap/` répond à `backlog/`.
- `PATTERNS.md` fusionne dans `conventions.md` — **trié, pas concaténé** : 376 lignes écrites avant
  la structure d'[ADR-0042](./ADR-0042-structure-api-modules.md), à passer au critère d'[ADR-0053](./ADR-0053-commentaire-passe-agissant.md).

## Critère de réouverture

**Une page d'architecture qui ment.** Si une divergence entre l'architecture et le code survit à un
chantier, la question n'est pas celle du découpage. Deux cas seulement, et ils appellent des réponses
opposées : ou bien l'affirmation était **dérivable et volatile**, et il manquait une garde ; ou bien
elle ne l'était pas, et **elle n'avait pas sa place sur cette page**. Coder une garde pour le second
cas est l'erreur à ne pas commettre.
