// ESLint flat config (ESLint 9) do monorepo Defesa Civil MG.
// Cobre apps/api (Node), apps/web (React) e packages/contracts.
// Regras "ruidosas" ficam como warning para não travar o CI; bugs reais
// (rules-of-hooks, variáveis não usadas) ficam como error.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.config.{js,cjs,mjs,ts}',
      'packages/contracts/src/*.js',
      'apps/api/prisma/**',
      'apps/web/public/**',
      // Scripts utilitarios Node (CommonJS) fora do pipeline da app.
      'apps/api/scripts/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend (NestJS) + contratos — ambiente Node.
  {
    files: ['apps/api/**/*.ts', 'packages/contracts/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },

  // Frontend (React + Vite) — ambiente browser.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Ajustes globais de severidade.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
);
