# ADR-0041 — Hiérarchie des autorités de conception

Statut : accepté · 2026-08-05
Portée : socle

## Contexte

Trois sources de convention se disputent chaque décision de structure, et rien ne disait laquelle
l'emporte :

| Source | Nature |
|---|---|
| La **documentation du framework** — Elysia, Drizzle, Bun | Prescriptive, mais partielle : elle décrit une app, un produit |
| La **réflexion produit** — ce dépôt, ses deux produits, ses contraintes mesurées | Contextuelle, la seule à connaître le cas réel |
| La **SSOT personnelle** (`~/.code-conform`) | Généraliste, subjective, datée — inspirée de Next.js, DDD, Zod, Tauri |

L'absence d'ordre ne produit pas de l'indécision, elle produit de l'**arbitrage au coup par coup**.
Constat direct, dans une seule discussion : le mot `domain/` (prescrit par la SSOT) a été écarté au
profit de `modules/` (documenté par Elysia) sans règle ; puis, deux messages plus loin, la SSOT a été
invoquée pour rejeter `index.ts = controller` (documenté par Elysia). Deux décisions contradictoires,
chacune défendable isolément, aucune justifiable ensemble.

Le symptôme est ancien. Le dossier `plugins/` de l'API nomme une catégorie qu'Elysia ne connaît pas —
sa définition officielle du plugin couvre **toute** instance Elysia, contrôleurs compris. Une
invention locale, jamais actée, qui a servi de fourre-tout à deux fichiers ne contenant pas une ligne
du framework.

## Options envisagées

- **Pas de hiérarchie** — arbitrer au cas par cas. C'est l'état actuel, et il produit l'incohérence
  décrite ci-dessus.
- **SSOT personnelle d'abord** — cohérence maximale entre projets, au prix d'un code qui diverge des
  exemples de l'outil et de ce que tout dev ou LLM produira par défaut en lisant sa doc.
- **Framework d'abord.**

## Décision

### L'ordre

1. **Le framework** — l'outil réellement en place. Ici Elysia pour le HTTP, Drizzle pour la
   persistance. La règle s'applique **par préoccupation**, pas globalement : Elysia n'a pas autorité
   sur le nommage des fichiers de schéma.
2. **La décision produit** — *est-ce que CE choix sert CE produit dans CE contexte ?* Elle prime sur
   la SSOT personnelle, parce qu'elle est la seule à connaître le cas réel.
3. **La SSOT personnelle** — consultée quand les deux premiers niveaux sont muets. C'est un document
   de travail transverse, pas une référence produit.

Le niveau inférieur ne prend la main que si le niveau supérieur est **muet**, jamais parce qu'on
préfère sa réponse.

### Tout ce qui est dans une doc n'a pas le même poids

Le niveau 1 n'est pas monolithique. Il faut distinguer :

- une **règle énoncée avec sa raison** — « 1 instance Elysia = 1 controller », « ne passe pas le
  Context entier, déstructure ». C'est un choix de conception de l'auteur, sur lequel l'outil
  s'appuie. On la suit même quand elle heurte nos habitudes : s'y opposer se paie en frictions
  mécaniques (types, dédoublonnage des plugins, inférence Eden) ;
- un **nom qui traverse un schéma** — `utils/` dans l'arborescence d'exemple d'Elysia. Aucune
  définition, aucune justification, une seule occurrence. Ce n'est pas une convention, c'est un
  décor.

**Trois questions pour trancher un écart :**

1. La doc l'**énonce**-t-elle, ou le **montre**-t-elle ?
2. Le suivre coûte-t-il quelque chose de **mesurable dans ce produit** ?
3. S'en écarter casse-t-il quelque chose de **mécanique**, ou seulement de l'esthétique ?

Un écart n'est légitime que si la doc *montre* sans énoncer **et** que le suivre a un coût mesuré.
Tout écart retenu est inscrit dans l'ADR qui le décide, avec sa raison.

### Où vit la SSOT produit

Les ADR et `docs-internal/reference/conventions.md` **sont** la SSOT de ce dépôt. Ils ont autorité
là où la SSOT personnelle n'est qu'un document de travail — laquelle vit hors du dépôt, en lecture
seule, et n'est jamais modifiée depuis ici.

À terme, le **code lui-même** doit devenir la référence : un lecteur ne devrait plus avoir à
consulter un document pour savoir où va un fichier. Cet ADR est un échafaudage de la phase de
construction, pas une fin.

## Conséquences

- La structure de l'API se dérive d'Elysia, pas de la SSOT — objet d'[ADR-0042](./ADR-0042-structure-api-modules.md).
  Chaque couche (dashboard Vue, storefront Astro, paquets partagés) devra faire le même exercice avec
  *son* framework, et pourra donc aboutir à des conventions différentes. **C'est attendu**, pas une
  incohérence : l'autorité est locale à la préoccupation.
- Quand deux frameworks se croisent dans un même fichier — une route Elysia qui écrit une requête
  Drizzle — chacun garde autorité sur ce qui le concerne.
- La SSOT personnelle reste consultable et peut évoluer de son côté. Un écart constaté ici ne la
  corrige pas : il est simplement noté dans l'ADR qui le rencontre.
