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
        '@stylistic/brace-style': ['error', '1tbs'],
        '@stylistic/indent': ['error', 'tab'],
        '@stylistic/no-tabs': 'off',
        '@stylistic/semi': ['error', 'always'],
    },
  },
);
