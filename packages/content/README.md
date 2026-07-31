# @mrcasquette/content

Déclaration de contenu **config-as-code** pour Échoppe.
Le développeur décrit ses **sections** de page et ses **components** réutilisables en TypeScript ;
la CLI sérialise ces définitions vers l'API (registre) et génère les types du front.

C'est un outil **build/dev-time** : il s'installe en `devDependency` et ne fait aucun appel runtime.

## Installation

```bash
pnpm add -D @mrcasquette/content
```

## Concepts

Trois verbes, trois niveaux :

- **`defineComponent`** — un atom/molecule : un groupe de champs nommé et **réutilisable**
  (`button`, `card`…). Non insérable seul dans une page ; s'imbrique dans d'autres définitions.
- **`defineSection`** — un **bloc de page** : ce que l'éditeur ajoute dans une page et que le
  front fetch puis boucle (`hero`, `cardGroup`…).
- **`defineContent`** — la racine, le **seul** point que lit la CLI. On y liste les sections ;
  les components sont **collectés automatiquement** en suivant les références.

## Exemple

```ts
import { defineComponent, defineSection, defineContent, field as f, link } from '@mrcasquette/content';

const card = defineComponent('card', {
  label: 'Carte',
  fields: {
    title: f.text({ required: true, maxLength: 80 }),
    body: f.richText(), // Markdown
    image: f.image(),
    cta: link, // component livré : { label, href, newTab }
  },
});

const hero = defineSection('hero', {
  label: 'Héros',
  fields: {
    title: f.text({ required: true }),
    variant: f.enum({ options: ['clair', 'sombre'] }),
    cta: link,
  },
});

const cardGroup = defineSection('cardGroup', {
  label: 'Groupe de cartes',
  fields: {
    heading: f.text(),
    cards: f.list(card), // répète un component nommé
  },
});

export default defineContent({ sections: [hero, cardGroup] });
```

## Champs (`field`, alias `f`)

**Primitifs** — `text`, `richText` (stocké en Markdown), `number` (`{ integer }`),
`boolean`, `date` (stocké en ISO 8601, `{ time }`), `enum` (`{ options, multiple }`).

**Fonctionnels** :

- `image()` — un média (UUID), résolu au read.
- `ref({ to })` — une référence catalogue (`product` | `collection` | `category`),
  résolue au read en projection d'entité.
- `list(component)` — répète un **component nommé** (by-reference).
- `repeater({ fields })` — répète un **groupe inline anonyme**, imbricable à la main
  (`repeater` dans `repeater` = menus à sous-niveaux).

Options communes : `label`, `hint`, `required`, `default`, plus des contraintes par type
(`minLength`/`maxLength`, `min`/`max`, `placeholder`, `format`).

## Licence

CeCILL-2.1
