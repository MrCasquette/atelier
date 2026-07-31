// Définitions de contenu de votre boutique (config-as-code).
//
// Vous déclarez ici vos blocs ; Échoppe les stocke, les valide et les sert. Le RENDU reste le
// vôtre (les composants de votre front). Après toute modification, synchronisez le registre de
// l'API :
//
//   pnpm content:push     # pousse vos définitions vers l'API (admin + validation)
//   pnpm content:check     # vérifie que le registre déployé est à jour (CI / pre-build)
//
// Les TYPES du contenu sont INFÉRÉS de ces déclarations (pas de codegen) : voir `Section` plus bas.
//
// Champs disponibles (f.text, f.richText, f.number, f.boolean, f.date, f.enum, f.image, f.ref,
// f.list, f.repeater) et composants réutilisables (defineComponent) — cf. @mrcasquette/content.

import { defineContent, defineSection, field as f, link, type InferSections } from '@mrcasquette/content';

// Une section « héros » : un bloc insérable dans une page depuis l'admin.
export const hero = defineSection('hero', {
  label: 'Héros',
  fields: {
    title: f.text({ label: 'Titre', required: true }),
    subtitle: f.text({ label: 'Sous-titre' }),
    cta: link, // composant livré : { label, href, newTab }
  },
});

export const content = defineContent({
  sections: [hero],
});

export default content;

// Union discriminée `{ id, type, data }` de vos sections, inférée des déclarations ci-dessus.
// Le rendu type chaque bloc via un `switch (section.type)` — voir l'exemple dans `src/lib/api.ts`.
export type Section = InferSections<typeof content>;

// ── Câbler le contenu dans votre front (exemple) ──────────────────────────────────────────────
// Le SDK renvoie `data: unknown` (il ignore votre registre). `asSections` retype le tableau à la
// frontière (l'API a validé à l'écriture → on truste). Dans `src/lib/api.ts` :
//
//   import { asSections } from '@mrcasquette/content';
//   import { content } from '@/content';
//
//   export async function getPage(slug: string) {
//     const { data } = await api.GET('/pages/by-slug/{slug}', { params: { path: { slug } } });
//     return data && { ...data, sections: asSections(content, data.sections) };
//   }
//
// Puis au rendu, `page.sections` est typé : `switch (section.type) { case 'hero': … }`.
