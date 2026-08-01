# ADR-0030 — Texte riche : Markdown, attributs sémantiques, saut dur explicite

Statut : accepté · 2026-08-01
Portée : socle

## Contexte

[systeme-contenu-leger.md](../design/systeme-contenu-leger.md) marquait ce choix « **décision
bloquante, à trancher AVANT toute implémentation** ». Il s'applique à tout contenu prose, dans les
deux produits.

État constaté : `richText` est un `t.String()` (`packages/content/src/field.ts:42`), et **il n'existe
aucun sanitizer HTML dans le projet**. Du HTML arbitraire est donc accepté, stocké, puis rendu par le
front — un vecteur de XSS stocké. Le risque est borné aujourd'hui (seuls des administrateurs
authentifiés écrivent), mais il signifie qu'un éditeur de contenu peut exécuter du JavaScript chez
tous les visiteurs, et il grandit dès que des utilisateurs moins fiables éditent des fiches.

Le contenu HTML existant est une reprise de Shopify — sa conversion n'est pas bloquante.

## Options envisagées

| | Markdown | HTML | JSON structuré |
|---|---|---|---|
| **Souveraineté** | ✅ lisible partout | ⚠️ pollué de présentation | ❌ illisible sans son rendu |
| **Sécurité** | ✅ sûr par construction | ❌ sanitizer obligatoire à maintenir | ✅ sûr par construction |
| **Expressivité** | ⚠️ limitée | ✅ tout | ✅ extensible |
| **Diff / revue** | ✅ | ⚠️ bruyant | ❌ |

## Décision

**Markdown**, avec deux règles.

### 1. Attributs sémantiques, jamais de classes CSS

Le contenu déclare une **intention**, le front décide de l'apparence :

```md
[Nous contacter](/contact){role=button}
```

Une classe Tailwind dans le contenu, c'est de la présentation stockée comme donnée : l'article
devient dépendant du CSS du site d'où il vient, et une refonte laisse des classes mortes partout.
C'est exactement la pollution reprochée au HTML, sous une syntaxe plus courte.

Bénéfice supplémentaire : restyler tous les boutons du site se fait dans le front, pas en rééditant
quarante articles. Et le vocabulaire d'attributs reste fini, donc validable.

### 2. Antislash en fin de ligne pour le saut dur, jamais le double espace

Markdown a deux notations pour `<br>` :

- **deux espaces en fin de ligne** — **proscrit** : invisibles, supprimés par n'importe quel
  formateur ou `trim()`, et fragiles à l'aller-retour JSON ;
- **un antislash en fin de ligne** — standard CommonMark, **visible**, survit à tout traitement.

Un WYSIWYG type TipTap distingue nativement paragraphe (`Entrée`) et saut dur (`Maj+Entrée`) ; la
sérialisation les traduit en ligne vide et en antislash. L'aller-retour est déterministe.

## Conséquences

- **Aucun sanitizer à écrire ni à maintenir.** Le vecteur de XSS stocké disparaît par construction.
- Le champ prose reste **sémantique**, cohérent avec la ligne présentation / donnée posée par
  [ADR-0026](./ADR-0026-sections-entites.md).
- **Ce que Markdown ne sait pas dire relève d'une section, pas de la prose.** Une image légendée, un
  encadré, une galerie, une vidéo intégrée sont des sections. Le seul cas inconfortable est le texte
  totalement libre laissé à l'utilisateur, jugé marginal.
- Migration du contenu HTML existant vers Markdown — chemin balisé, non bloquant.
- L'option `breaks: true` des parseurs (un retour à la ligne simple devient `<br>`) est **écartée** :
  plus intuitive à la main, mais elle casse la convention d'un paragraphe replié sur plusieurs lignes.
