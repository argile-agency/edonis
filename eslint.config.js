import { configApp } from '@adonisjs/eslint-config'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  ...configApp(),
  {
    rules: {
      // `== null` / `!= null` are intentional nullish checks (null + undefined).
      // Lucid passes `undefined` to column consume/prepare hooks, so strict
      // equality here would silently drop those cases.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['inertia/**/*.tsx', 'inertia/**/*.jsx'],
  },
  {
    files: ['inertia/pages/showcase.tsx'],
    rules: {
      'jsx-a11y/label-has-associated-control': 'off',
    },
  },
  {
    // Guard for DEBT-02: `as any` is banned in backend code. Core ESLint rule,
    // so it needs no type-aware linting (the Adonis preset does not enable it).
    files: ['app/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAnyKeyword',
          message:
            '`as any` is banned in app/. Narrow the type properly instead: an annotated local for polymorphic `this`, structural guards for `unknown` errors, `pojo<T>()` for aggregates, or direct Luxon comparison for `DateTime`. See .planning/phases/01-code-health-baseline/01-RESEARCH.md.',
        },
      ],
    },
  },
]
