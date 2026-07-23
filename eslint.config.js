import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', 'desktop/**', '**/*.config.*'] },
  ...tseslint.configs.strict,
  {
    rules: {
      'no-inline-comments': 'error',
      'line-comment-position': 'error',
      'eqeqeq': 'error',
      'no-else-return': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/test/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
)
