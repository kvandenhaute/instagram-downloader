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
        // Overrides t.o.v. recommended (andere opties)
        '@stylistic/array-bracket-spacing': ['error', 'always', { arraysInArrays: true }], // recommended: 'never'
        '@stylistic/arrow-parens': ['error', 'as-needed'], // recommended voegt requireForBlockBody: true toe
        '@stylistic/brace-style': ['error', '1tbs'], // recommended: 'stroustrup'
        '@stylistic/computed-property-spacing': ['error', 'always'], // recommended: 'never'
        '@stylistic/indent': ['error', 'tab'], // recommended: 2 spaties
        '@stylistic/multiline-ternary': ['error', 'never'], // recommended: 'always-multiline'
        '@stylistic/no-extra-parens': 'error', // recommended: alleen 'functions', wij willen 'all'
        '@stylistic/no-mixed-operators': 'off', // recommended: 'error'
        '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 1, maxEOF: 1 }], // recommended: maxBOF/maxEOF: 0
        '@stylistic/no-tabs': 'off', // recommended: 'error'
        '@stylistic/quote-props': ['error', 'as-needed'], // recommended: 'consistent-as-needed'
        '@stylistic/quotes': ['error', 'single', { avoidEscape: true }], // recommended: avoidEscape: false
        '@stylistic/semi': ['error', 'always'], // recommended: 'never'
        '@stylistic/spaced-comment': ['error', 'always'], // recommended voegt uitzonderingen toe voor //, #!, etc.

        // Niet in recommended
        '@stylistic/function-call-spacing': 'error',
        '@stylistic/function-paren-newline': ['error', 'consistent'],
        '@stylistic/implicit-arrow-linebreak': 'error',
        '@stylistic/no-extra-semi': 'error',
        '@stylistic/padding-line-between-statements': ['error', { blankLine: 'always', prev: '*', next: 'return' }],
        '@stylistic/semi-style': 'error',
        '@stylistic/wrap-regex': 'error',
    },
  },
);
