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
]
