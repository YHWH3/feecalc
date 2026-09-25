// @ts-check
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default defineConfig(
  {
    ignores: [
      'dist',
      '.astro',
      'coverage',
      'node_modules',
      'playwright-report',
      'test-results',
      'src/env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      // src/core is framework-agnostic: no DOM, no UI, no Astro imports.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['astro', 'astro/*', 'astro:*', '@ui/*', '@lib/*', '**/ui/**'],
              message: 'src/core must stay framework-agnostic: no Astro, DOM, or UI imports.',
            },
          ],
        },
      ],
    },
  },
);
