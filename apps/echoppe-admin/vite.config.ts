import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '../..'), '');
  const adminPort = parseInt(env.ADMIN_PORT || '3211');
  const apiPort = env.API_PORT || '7532';

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
      port: adminPort,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
