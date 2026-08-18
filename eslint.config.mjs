// Linter unique du workspace `atelier` — un seul geste couvre tous les produits.
//
// Pourquoi ESLint partout plutôt que Biome : Biome ne résout pas les références d'un
// `<template>`. Dans un SFC Vue ou un composant Astro, tout ce qui n'est référencé que par le
// template est déclaré mort — mesuré à 880 faux positifs sur `echoppe-admin`, 13 sur
// `echoppe-store`, tous concentrés sur `noUnusedVariables` / `noUnusedImports`. Les parsers
// `vue-eslint-parser` et `astro-eslint-parser` lisent le template, eux.
//
// Biome reste le FORMATEUR (cf. `biome.json`, section `formatter`). La frontière est donc
// « linter / formateur », orthogonale au code — et non plus « quel fichier va à quel linter »,
// qui laissait silencieusement trois workspaces sans couverture.
//
// Aucun nom de produit n'apparaît ici : la config s'applique par NATURE de fichier.

import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import astro from 'eslint-plugin-astro';
import unused from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import vueParser from 'vue-eslint-parser';

/** Règles TypeScript communes — l'équivalent ESLint de ce que Biome appliquait. */
const typescriptRules = {
  'no-undef': 'off', // TypeScript s'en charge, et le connaît mieux
  'no-unused-vars': 'off', // remplacée par la version typée, qui comprend les positions de type
  'no-redeclare': 'off', // les surcharges TS sont des redéclarations légitimes
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'unused-imports/no-unused-imports': 'error',
  'prefer-const': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/no-non-null-assertion': 'warn',
};

export default [
  {
    // Artefacts générés ou figés : jamais lintés, et jamais corrigés à la main.
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.vitepress/cache/**',
      '**/.vitepress/dist/**',
      '**/.astro/**',
      'packages/echoppe-client/src/openapi.ts',
      'packages/echoppe-client/src/models.ts',
      'packages/echoppe-client/src/facade.ts',
      'packages/echoppe-core/drizzle/**',
      // Template de scaffolding : c'est le dépôt généré qui le lintera, avec SES règles.
      'packages/create-echoppe/template/**',
    ],
  },

  js.configs.recommended,

  // TypeScript pur : paquets partagés, APIs, scripts d'outillage.
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': ts, 'unused-imports': unused },
    rules: typescriptRules,
  },

  // Composants Vue : le parser lit le <template>, sans quoi tout y paraît inutilisé.
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': ts, 'unused-imports': unused },
    rules: {
      ...typescriptRules,
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': [
        'error',
        { html: { void: 'always', normal: 'always', component: 'always' } },
      ],
    },
  },

  // Composants Astro : même raison que Vue.
  ...astro.configs.recommended,

  // Interdiction des assertions de type, étendue par LOT.
  //
  // `as X` n'est pas un cast : rien n'est converti à l'exécution, la vérification est simplement
  // effacée. Une assertion signale presque toujours une garde qui existe mais reste invisible au
  // type — la sortie est de la rendre visible (narrowing, `Exclude<>`, `satisfies`, type guard),
  // pas de faire taire le compilateur.
  //
  // 210 occurrences au 2026-08-18. La règle s'étend à chaque lot nettoyé, et ce qui est nettoyé ne
  // peut plus régresser. `as const` reste permis : il restreint au lieu d'élargir.
  //
  // Faits : `scripts/`, `packages/`, `docs/` et `apps/echoppe-api` sont clos. Reste le dashboard.
  {
    files: [
      'scripts/**/*.ts',
      'packages/**/*.ts',
      'docs/**/*.{ts,vue}',
      'apps/echoppe-api/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },

  // Fronts : `console` et `debugger` n'ont rien à faire dans une interface livrée.
  // Repris de l'ancienne config d'`echoppe-admin`, généralisé par NATURE (front), pas par produit.
  {
    files: ['apps/*-admin/**', 'apps/*-store/**'],
    rules: { 'no-console': 'warn', 'no-debugger': 'warn' },
  },

  // Fichiers de configuration à la racine des workspaces : contexte Node, pas navigateur.
  {
    files: ['**/*.config.{js,mjs,ts}', '**/*.config.*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Code exécuté par Bun (scripts d'outillage, APIs) : `Bun`, `process`, `console`.
  {
    files: ['scripts/**/*.ts', 'apps/*-api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: { globals: { ...globals.node, Bun: 'readonly' } },
  },
];
