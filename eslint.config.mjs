import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      '.vite/**',
      'out/**',
      'dist/**',
      '*.config.js',
      '*.config.mjs',
      '*.config.ts',
    ],
  },

  // Base JS config
  js.configs.recommended,

  // TS config
  ...tseslint.configs.recommended,

  // React config for Renderer files
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)components/ui/(?!icons(?:$|/(?:space|file-icons)$)).+',
              message:
                'Import shared UI from @/components/ui. Use only the icons, icons/space, or icons/file-icons sub-barrels directly.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: 'Use Input from @/components/ui instead of a raw <input>.',
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message: 'Use Textarea from @/components/ui instead of a raw <textarea>.',
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: 'Use Select or NativeSelect from @/components/ui instead of a raw <select>.',
        },
      ],
    },
  },

  // UI primitives own the native elements; renderer features consume the
  // primitives above so styling and accessibility behavior cannot drift.
  {
    files: ['src/renderer/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },

  // Main Process config
  {
    files: ['src/main/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Preload Scripts config
  {
    files: ['src/preload/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
  },

  // Common TS rules for both Renderer and Main Process
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
