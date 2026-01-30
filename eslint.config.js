import { configApp } from '@adonisjs/eslint-config'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default [
  ...configApp(),
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
