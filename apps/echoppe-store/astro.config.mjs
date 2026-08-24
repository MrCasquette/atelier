import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// SSR (topologie B) : les appels API se font côté serveur via le SDK @axiome-apps/echoppe-client.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Littéral, pas une variable : le port dit le rang de la pile (ADR-0054), et ce store est la
  // vitrine du dépôt — jamais un livrable. Un front de boutique garde le défaut d'Astro.
  server: { port: 3100 },
  vite: {
    plugins: [tailwindcss()],
  },
});
