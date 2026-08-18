import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// Littéraux, pas des variables : ces deux ports disent le rang de la pile (ADR-0054). Ce serveur
// n'existe qu'en développement — en production le dashboard est servi par l'API, sans port à lui.
const ADMIN_PORT = 3110;
const API_PORT = 8101; // l'API des sources, celle que `bun run dev` fait tourner

export default defineConfig(() => {
  return {
    // Le dashboard est servi sous `/-/admin` par l'API (ADR-0052). Les assets doivent donc être
    // référencés sous ce préfixe — sinon `index.html` les demande à la racine, où vit l'API.
    // Vaut aussi en développement : Vite sert le même chemin, le code ne connaît qu'une topologie.
    base: '/-/admin/',
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: ADMIN_PORT,
      proxy: {
        '/api': {
          target: `http://localhost:${API_PORT}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
