import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  stylistic.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
        // '@stylistic/array-bracket-newline': ['error', { multiline: true }],
        '@stylistic/array-bracket-spacing': ['error', 'always', { arraysInArrays: true }],
        '@stylistic/arrow-parens': ['error', 'as-needed'],
        '@stylistic/arrow-spacing': 'error',
        '@stylistic/block-spacing': 'error',
        '@stylistic/brace-style': ['error', '1tbs'],
        // '@stylistic/comma-dangle': 'error',
        // '@stylistic/comma-style': 'error',
        '@stylistic/computed-property-spacing': ['error', 'always'],
        // '@stylistic/dot-location': ['error', 'property'],
        '@stylistic/eol-last': 'error',
        '@stylistic/function-call-spacing': 'error',
        '@stylistic/function-paren-newline': ['error', 'consistent'],
        '@stylistic/implicit-arrow-linebreak': 'error',
        '@stylistic/indent': ['error', 'tab'],
        '@stylistic/key-spacing': 'error',
        '@stylistic/keyword-spacing': 'error',
        '@stylistic/multiline-ternary': ['error', 'never'],
        '@stylistic/no-extra-parens': 'error',
        '@stylistic/no-extra-semi': 'error',
        '@stylistic/no-floating-decimal': 'error',
        '@stylistic/no-mixed-operators': 'off',
        '@stylistic/no-multi-spaces': 'error',
        '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 1, maxEOF: 1 }],
        '@stylistic/no-tabs': 'off',
        '@stylistic/no-trailing-spaces': 'error',
        '@stylistic/no-whitespace-before-property': 'error',
        '@stylistic/object-curly-spacing': ['error', 'always'],
        '@stylistic/padding-line-between-statements': ['error', { blankLine: 'always', prev: '*', next: 'return' }],
        '@stylistic/quote-props': ['error', 'as-needed'],
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
        '@stylistic/semi': ['error', 'always'],
    },
  },
);
