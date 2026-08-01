import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Enforces code_standards.md. These are CI failures, not warnings — a budget
 * you can exceed is not a budget (§2).
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**']),

  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      /* ---- §2 Size & complexity budgets ---- */
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'max-params': ['error', 3],
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 50, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-nested-callbacks': ['error', 3],

      /* ---- §4 TypeScript ---- */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /* ---- §8 Dead code / clarity ---- */
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-nested-ternary': 'error',

      /* ---- §1.4 Feature boundaries ---- */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message:
                'Import another feature through its barrel: @/features/<name>. See code_standards.md §1.4.',
            },
          ],
        },
      ],
    },
  },

  /* Rule 3: shared/ must never depend on features/ or app/. */
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/**', '@/app/**'],
              message:
                'shared/ must not depend on features/ or app/. If it needs feature knowledge, it is not shared.',
            },
          ],
        },
      ],
    },
  },

  /* A feature may reach into its own internals freely. */
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },

  /* Tests and mocks get room to breathe. */
  {
    files: ['**/*.test.{ts,tsx}', 'src/mocks/**/*.{ts,tsx}'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'no-console': 'off',
    },
  },
]);

export default eslintConfig;
