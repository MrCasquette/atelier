import { defineConfig } from 'vitepress';
// Généré par `bun run gen:reference` — arbre namespace→modèle de la référence SDK.
import referenceNav from './generated/sdk-reference-nav.json';
// Thèmes Shiki calqués sur la palette Axiome (teinte 272 + sémantiques).
import axiomeDark from './theme/shiki/axiome-dark.json';
import axiomeLight from './theme/shiki/axiome-light.json';

export default defineConfig({
  title: 'Échoppe',
  description: 'Documentation de la plateforme e-commerce Échoppe',
  lang: 'fr-FR',
  base: '/echoppe/',
  // La doc interne vit hors de l'arbre VitePress (`docs-internal/` à la racine) → plus besoin
  // de srcExclude : la séparation est physique, pas une exclusion de config.
  // Détection des liens morts active (attrape les vrais liens cassés) ; seules les URLs
  // localhost de dev (Swagger, admin, API) sont tolérées.
  ignoreDeadLinks: 'localhostLinks',

  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],

  // Axiome est sombre par défaut (direction officielle) ; le clair reste accessible via
  // le sélecteur de la barre de nav.
  appearance: 'dark',

  // Coloration de syntaxe alignée sur la palette Axiome : mots-clés indigo, chaînes en
  // succès, commentaires en encre 3. Aucun thème Shiki embarqué ne tient la teinte unique.
  markdown: {
    theme: { light: axiomeLight, dark: axiomeDark },
  },

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Admin', link: '/admin/' },
      { text: 'SDK', link: '/sdk/' },
      { text: 'Développeur', link: '/dev/' },
      { text: 'Roadmap', link: '/roadmap' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Présentation', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Mise à jour', link: '/guide/mise-a-jour' },
          ],
        },
      ],
      '/admin/': [
        {
          text: 'Administration',
          items: [
            { text: 'Vue d\'ensemble', link: '/admin/' },
            { text: 'Produits', link: '/admin/products' },
            { text: 'Catégories & Collections', link: '/admin/taxonomy' },
            { text: 'Commandes', link: '/admin/orders' },
            { text: 'Clients', link: '/admin/customers' },
            { text: 'Stock', link: '/admin/stock' },
            { text: 'Médiathèque', link: '/admin/media' },
            { text: 'Paramètres', link: '/admin/settings' },
          ],
        },
      ],
      '/sdk/': [
        {
          text: 'SDK @echoppe/client',
          items: [
            { text: 'Présentation', link: '/sdk/' },
            { text: 'Installation', link: '/sdk/installation' },
            { text: 'Utilisation', link: '/sdk/usage' },
            { text: 'Types & surface', link: '/sdk/types' },
            referenceNav,
          ],
        },
      ],
      '/dev/': [
        {
          text: 'Développeur',
          items: [
            { text: 'Architecture', link: '/dev/' },
            { text: 'API REST', link: '/dev/api' },
            { text: 'Base de données', link: '/dev/database' },
            { text: 'Authentification', link: '/dev/auth' },
            { text: "Clés d'API", link: '/dev/api-keys' },
            { text: 'Module contenu', link: '/dev/content' },
            { text: 'Publier une version', link: '/dev/releasing' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Publié sous licence CeCILL v2.1.',
      copyright: 'Copyright © 2024-present Échoppe',
    },

    outline: {
      label: 'Sur cette page',
    },

    docFooter: {
      prev: 'Page précédente',
      next: 'Page suivante',
    },

    lastUpdated: {
      text: 'Mis à jour le',
    },

    returnToTopLabel: 'Retour en haut',
    sidebarMenuLabel: 'Menu',
    darkModeSwitchLabel: 'Thème',
  },
});
