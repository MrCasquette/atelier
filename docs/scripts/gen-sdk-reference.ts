#!/usr/bin/env bun
/**
 * Génère `docs/sdk/reference.md` : par modèle, un titre (outline VitePress), le composant
 * `<ModelDoc>` (propriétés, rendu par le thème Vue), puis les exemples d'appel (code-group
 * SDK/REST) et de réponse en markdown → coloration Shiki + onglets natifs.
 *
 * Alimenté par le contrat `packages/echoppe-client/openapi.json` : la page suit le contrat.
 * Usage : `bun run gen:reference` (depuis le paquet docs).
 */
import { anchor, codeExample, modelNames, namespaceFor, restExample } from '../.vitepress/theme/lib/openapi';

const OUTPUT = new URL('../sdk/reference.md', import.meta.url);
// Arbre de nav namespace→modèle, importé par config.ts pour la sidebar de la page (mode API).
const NAV_OUTPUT = new URL('../.vitepress/generated/sdk-reference-nav.json', import.meta.url);

// Ordre d'affichage des namespaces (aligné sur la façade). Tout namespace absent d'ici est
// ajouté à la fin ; les modèles sans namespace tombent dans « Autres ».
const NAMESPACE_ORDER = [
  'products',
  'categories',
  'collections',
  'cart',
  'checkout',
  'taxRates',
  'auth',
  'account',
  'addresses',
  'orders',
];
const OTHER = 'Autres';

// Regroupe les modèles par namespace de la façade.
const byNamespace = new Map<string, string[]>();
for (const name of modelNames) {
  const ns = namespaceFor(name) ?? OTHER;
  (byNamespace.get(ns) ?? byNamespace.set(ns, []).get(ns)!).push(name);
}
const orderedNamespaces = [
  ...NAMESPACE_ORDER.filter((ns) => byNamespace.has(ns)),
  ...[...byNamespace.keys()].filter((ns) => !NAMESPACE_ORDER.includes(ns) && ns !== OTHER).sort(),
  ...(byNamespace.has(OTHER) ? [OTHER] : []),
];

const lines: string[] = [
  // Mode API : pas de TOC droite (aside:false) — la nav namespace→modèle vit dans la
  // sidebar gauche ; `pageClass` active la mise en page 2 colonnes (cf. api-reference.css).
  '---',
  'aside: false',
  'pageClass: api-reference',
  '---',
  '',
  '<!-- Généré par docs/scripts/gen-sdk-reference.ts — NE PAS ÉDITER À LA MAIN. -->',
  '',
  '# Référence des modèles',
  '',
  'Forme de chaque schéma exposé par le SDK (surface boutique), rendue depuis le contrat',
  'figé `@axiome-apps/echoppe-client`. Les modèles sont **regroupés par namespace** de la façade',
  '(`echoppe.<namespace>.<méthode>()`). Chaque modèle liste ses propriétés (type, description,',
  'objets imbriqués dépliables) avec un exemple d’appel et un exemple de réponse.',
  '',
];

for (const ns of orderedNamespaces) {
  lines.push(`## ${ns === OTHER ? OTHER : `\`${ns}\``}`, '');

  for (const name of byNamespace.get(ns)!) {
    // Titre hors du bloc → il porte l'ancre (cible de la sidebar) et s'étend pleine largeur.
    // Colonne gauche = schéma ; colonne droite (sticky) = exemples d'appel + de réponse.
    lines.push(`### ${name}`, '', '<ApiBlock>', '', '<template #doc>', '', `<ModelDoc name="${name}" />`, '', '</template>', '', '<template #code>', '');

    const sdk = codeExample(name);
    const rest = restExample(name);
    if (sdk && rest) {
      lines.push(
        '**Exemple d’appel**',
        '',
        '::: code-group',
        '',
        '```ts [SDK]',
        sdk,
        '```',
        '',
        '```js [REST]',
        rest,
        '```',
        '',
        ':::',
        '',
      );
    }

    lines.push('**Exemple de réponse**', '', `<ResponseSample name="${name}" />`, '', '</template>', '', '</ApiBlock>', '');
  }
}

await Bun.write(OUTPUT, `${lines.join('\n').trimEnd()}\n`);

// Sidebar imbriquée namespace→modèle (remplace la TOC droite sur cette page).
const referenceNav = {
  text: 'Référence des modèles',
  link: '/sdk/reference',
  collapsed: false,
  items: orderedNamespaces.map((ns) => ({
    text: ns === OTHER ? OTHER : ns,
    collapsed: true,
    items: byNamespace.get(ns)!.map((name) => ({
      text: name,
      link: `/sdk/reference#${anchor(name)}`,
    })),
  })),
};
await Bun.write(NAV_OUTPUT, `${JSON.stringify(referenceNav, null, 2)}\n`);

console.log(`✓ docs/sdk/reference.md + nav généré (${modelNames.length} modèles)`);
