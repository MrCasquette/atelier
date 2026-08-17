# Module contenu

Échoppe embarque un **page builder headless**. Vous déclarez vos **blocs** en
_config-as-code_ ; Échoppe les **stocke**, les **valide** et les **sert**. Le **rendu reste
le vôtre** — les composants de votre front décident de l'apparence, quel que soit votre
framework.

C'est le pendant « pages éditoriales » du catalogue e-commerce : une page (`page`) est une
suite ordonnée de **sections** (`section[]`), chaque section portant des données (`data`)
conformes à la définition que vous avez déclarée.

## Le package `@mrcasquette/content`

Outillage **build/dev-time**, installé en **devDependency** par `create-echoppe`. Il ne fait
aucun appel réseau à l'exécution de votre boutique : il sert à **déclarer** vos blocs et à
**pousser** leur registre vers l'API.

```ts
import { defineContent, defineSection, defineComponent, field as f, link } from '@mrcasquette/content';
```

## Déclarer un contenu

Votre config vit dans `src/content/index.ts`. Trois verbes :

| Verbe | Rôle |
|-------|------|
| `defineSection(name, config)` | un **bloc de page**, insérable dans une page depuis l'admin |
| `defineComponent(name, config)` | un **groupe de champs réutilisable**, imbriqué dans d'autres blocs (non insérable seul) |
| `defineContent({ sections })` | la **racine** — le seul point lu par la CLI |

```ts
import { defineContent, defineSection, field as f, link } from '@mrcasquette/content';

export const hero = defineSection('hero', {
  label: 'Héros',
  fields: {
    title: f.text({ label: 'Titre', required: true }),
    subtitle: f.text({ label: 'Sous-titre' }),
    cta: link, // composant livré : { label, href, newTab }
  },
});

export default defineContent({
  sections: [hero],
});
```

Les **components** référencés par vos sections (par imbrication comme `cta: link`, ou via
`f.list(card)`) sont **collectés automatiquement** — pas besoin de les lister dans
`defineContent`.

## Les champs (`field`, alias `f`)

Chaque champ accepte des méta communes : `label`, `hint`, `required`.

| Builder | Type édité | Options notables |
|---------|-----------|------------------|
| `f.text()` | texte court | `minLength`, `maxLength`, `format`, `placeholder`, `default` |
| `f.richText()` | texte riche (Markdown) | `placeholder`, `default` |
| `f.number()` | nombre | `integer`, `min`, `max`, `default` |
| `f.boolean()` | booléen | `default` |
| `f.date()` | date ISO 8601 | `time` (inclure l'heure), `default` |
| `f.enum()` | choix | `options` (`string[]` ou `{ value, label }[]`), `multiple`, `default` |
| `f.image()` | média (UUID, résolu au read) | — |
| `f.ref()` | référence catalogue | `to`: `'product' \| 'collection' \| 'category'` |
| `f.list(of)` | répétition d'un **component nommé** | `min`, `max` |
| `f.repeater()` | répétition d'un **groupe inline** anonyme | `fields`, `min`, `max` |

Exemple avec un component réutilisable et une liste :

```ts
import { defineComponent, defineSection, field as f } from '@mrcasquette/content';

const card = defineComponent('card', {
  fields: {
    title: f.text({ required: true }),
    image: f.image({ label: 'Visuel' }),
    link: f.ref({ to: 'product', label: 'Produit' }),
  },
});

export const grid = defineSection('grid', {
  label: 'Grille',
  fields: {
    heading: f.text({ label: 'Titre de section' }),
    cards: f.list(card, { min: 1, max: 6 }),
  },
});
```

## Synchroniser (`content:push`)

Vos fichiers sont la **source d'autorité** ; l'API en garde un miroir. Après toute
modification de vos définitions :

```bash
pnpm content:push
```

La CLI sérialise votre `defineContent` en **registre JSON** et le pousse en `PUT
/content/registry`. Deux prérequis dans le `.env` :

```dotenv
PUBLIC_API_URL=http://localhost:7532
CONTENT_API_KEY=eck_votre_cle   # portée write:schema
```

La clé s'obtient dans l'admin (**« Clés d'API »**) — voir [Clés d'API](/dev/api-keys).

Le push est **remplace-tout** et **transactionnel**. Un registre **incohérent** (référence de
component introuvable, cycle) est **refusé** avant toute écriture (`422`).

::: warning Vos définitions sont du code — traitez le registre comme une migration
Le registre déployé est un **miroir de vos fichiers**, poussé à sens unique (**pas** de sync
bidirectionnelle : l'admin édite du _contenu_, pas des _définitions_). Comme une migration de
base, il faut le **pousser au déploiement**. Le risque, sinon, c'est la **dérive** : un front
déployé qui attend des blocs que l'API ne connaît pas encore (oubli de `push`).

Deux garde-fous :
- **Poussez au déploiement** — ajoutez `content:push` à votre pipeline (hook `prebuild` /
  étape de déploiement) pour que livrer le front **pousse** son registre.
- **Vérifiez en CI** avec `content:check` (portée `read:content`) : il compare le registre
  local au déployé et **échoue** s'ils divergent, sans rien écrire.

```bash
pnpm content:check   # exit 1 si le registre déployé n'est plus à jour
```

En **dev local**, inutile de pousser à chaque modif : votre front se type depuis vos fichiers
(voir plus bas). Le push ne sert qu'à la **parité admin + validation**.
:::

## Validation des données

Quand l'admin enregistre les sections d'une page, l'API **valide chaque bloc** contre sa
définition dans le registre : types, contraintes (`min`/`max`, `required`, `enum`…), formats.
Un bloc non conforme, ou d'un **type inconnu**, renvoie un `422` détaillant le champ fautif.

Vous n'écrivez donc aucun validateur : déclarer le champ **suffit** à le contraindre.

## Typer le contenu (inféré, sans codegen)

Vos types **sortent de vos déclarations** — pas de génération de fichier, pas d'aller-retour
par l'API. `@mrcasquette/content` fournit deux utilitaires d'inférence :

```ts
import type { InferData, InferSections } from '@mrcasquette/content';
import { content, hero } from '@/content';

type HeroData = InferData<typeof hero>;        // { title: string; subtitle?: string; cta: {…} }
type Section  = InferSections<typeof content>; // union discriminée { id; type; data }
```

Un champ `required: true` devient une propriété **requise**, sinon **optionnelle** ; un
`f.enum` devient une **union de littéraux** ; `f.list(card)` devient `CardData[]` ; un
component imbriqué (`cta: link`) devient son propre type. Modifier une déclaration met à jour
les types **immédiatement**.

## Rendre le contenu (côté vous)

Échoppe **ne rend rien**. Votre front lit les pages via le SDK (`@echoppe/client`), qui type
`data` en `unknown` (il ignore votre registre). `asSections` **retype** le tableau à la
frontière — l'**unique** conversion, fournie par la lib (l'API ayant validé à l'écriture, on
truste ; vous n'écrivez donc jamais de cast). Placez-la à votre frontière SDK, typiquement
`src/lib/api.ts` :

```ts
import { asSections } from '@mrcasquette/content';
import { content } from '@/content';

export async function getPage(slug: string) {
  const { data } = await api.GET('/pages/by-slug/{slug}', { params: { path: { slug } } });
  return data && { ...data, sections: asSections(content, data.sections) };
}
```

Le rendu **mappe chaque `type` vers le composant correspondant** de votre front — un seul
`switch`, `data` est typé dans chaque branche :

```tsx
page.sections.map((section) => {
  switch (section.type) {
    case 'hero': return <Hero data={section.data} />; // data: HeroData
    // …un case par section déclarée
  }
});
```

Les **variantes** d'un bloc sont un simple champ `f.enum` : votre composant de section branche
dessus (`data.variant === 'simple' ? … : …`) — le framework ne connaît que le type de section,
le sous-rendu reste chez vous.

## Cycle de vie complet

```
src/content/*.ts   content:push          API              content_definition
      │ defineContent()  │                 │                      │
      ├─────────────────▶│                 │                      │
      │                  │ serialize() → registre JSON            │
      │                  ├──╮              │                      │
      │                  │◀─╯              │                      │
      │                  │ PUT /content/registry (Bearer eck_…)   │
      │                  ├────────────────▶│                      │
      │                  │                 │ cohérence (refs, cycles) → 422 sinon
      │                  │                 ├──╮                   │
      │                  │                 │◀─╯                   │
      │                  │                 │ remplace-tout (transaction)
      │                  │                 ├─────────────────────▶│

  Ensuite : l'admin édite les pages → chaque bloc est validé contre le registre.
```
