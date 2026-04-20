// eslint.config.mjs
// ESLint 9 Flat Config - 各 plugin 原生 flat config，無 FlatCompat 橋接
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import nextPlugin from '@next/eslint-plugin-next';
import jsdoc from 'eslint-plugin-jsdoc';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import confusingGlobals from 'confusing-browser-globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  // 1. ESLint 官方推薦
  js.configs.recommended,

  // 1.5 全域變數定義（等效 Airbnb 的 env: { browser: true, node: true }）
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // 2. React（recommended + jsx-runtime 關掉 react-in-jsx-scope）
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],

  // 3. React Hooks（手動控制：12 條 error + 5 compiler off）
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // 原始 2 條
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // v7 品質規則（React purity 規範）
      'react-hooks/purity': 'error',
      'react-hooks/immutability': 'error',
      'react-hooks/globals': 'error',
      'react-hooks/refs': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/set-state-in-effect': 'error',
      'react-hooks/static-components': 'error',
      'react-hooks/use-memo': 'error',
      'react-hooks/error-boundaries': 'error',
      'react-hooks/component-hook-factories': 'error',
      // Compiler 專用（目前不用）
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
    },
  },

  // 4. Accessibility
  jsxA11y.flatConfigs.recommended,

  // 5. Import（recommended + resolver 設定）
  importPlugin.flatConfigs.recommended,
  {
    settings: {
      'import/resolver': {
        alias: {
          map: [['@', './src']],
          extensions: ['.js', '.jsx', '.mjs', '.json'],
        },
      },
    },
  },

  // 6. Next.js（原生 flat config）
  nextPlugin.flatConfig.coreWebVitals,

  // 7. JSDoc
  jsdoc.configs['flat/recommended'],

  // 8. 品質規則（Airbnb 精選 + reviewer 補充，非格式）
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // === Best Practices ===
      'no-alert': 'warn',
      'no-await-in-loop': 'error',
      'array-callback-return': ['error', { allowImplicit: true }],
      'consistent-return': 'error',
      'default-case': 'error',
      'default-case-last': 'error',
      'dot-notation': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'guard-for-in': 'error',
      'no-caller': 'error',
      'no-constructor-return': 'error',
      'no-empty-function': [
        'error',
        {
          allow: ['arrowFunctions', 'functions', 'methods'],
        },
      ],
      'no-eval': 'error',
      'no-extend-native': 'error',
      'no-extra-bind': 'error',
      'no-implied-eval': 'error',
      'no-iterator': 'error',
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-loop-func': 'error',
      'no-new': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-param-reassign': [
        'error',
        {
          props: true,
          ignorePropertyModificationsFor: [
            'acc',
            'accumulator',
            'e',
            'ctx',
            'context',
            'req',
            'request',
            'res',
            'response',
            '$scope',
            'staticContext',
          ],
        },
      ],
      'no-promise-executor-return': 'error',
      'no-proto': 'error',
      'no-restricted-globals': ['error', ...confusingGlobals],
      'no-return-assign': ['error', 'always'],
      'no-script-url': 'error',
      'no-self-compare': 'error',
      'no-sequences': 'error',
      'no-throw-literal': 'error',
      'no-unused-expressions': [
        'error',
        {
          allowShortCircuit: true,
          allowTernary: true,
          allowTaggedTemplates: true,
        },
      ],
      'no-useless-concat': 'error',
      'no-useless-constructor': 'error',
      'no-void': 'error',
      'prefer-promise-reject-errors': 'error',
      radix: 'error',
      yoda: 'error',

      // === Modern JS ===
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'prefer-destructuring': [
        'error',
        {
          VariableDeclarator: { array: false, object: true },
          AssignmentExpression: { array: true, object: false },
        },
      ],
      'arrow-body-style': ['error', 'as-needed'],

      // === Variables ===
      'no-shadow': 'error',
      'no-underscore-dangle': 'error',
      'no-use-before-define': 'error',

      // === Import（超出 recommended 的部分）===
      'import/first': 'error',
      'import/no-mutable-exports': 'error',
      'import/no-self-import': 'error',
      'import/no-cycle': 'error',
      'import/no-useless-path-segments': 'error',
      'import/newline-after-import': 'error',
      'import/prefer-default-export': 'error',
      'import/order': [
        'error',
        {
          groups: [['builtin', 'external', 'internal']],
        },
      ],

      // === 專案自訂覆寫（保持不變）===
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react/prop-types': 'off',
      'react/jsx-filename-extension': ['warn', { extensions: ['.js', '.jsx'] }],
      'react/require-default-props': 'off',
      'react/jsx-props-no-spreading': 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.test.js',
            '**/*.test.jsx',
            '**/*.test.mjs',
            '**/*.spec.js',
            '**/*.spec.jsx',
            '**/*.spec.mjs',
            '**/vitest.config.js',
            '**/vitest.config.mjs',
            '**/vitest.setup.*',
            '**/playwright.config.js',
            '**/playwright.config.mjs',
            '**/playwright.*.config.mjs',
            '**/e2e/**/*.{js,jsx,mjs}',
            '**/.claude/skills/**/*.js',
            '**/.gemini/skills/**/*.js',
          ],
        },
      ],
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'jsdoc/require-jsdoc': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
    },
  },

  // 9. Type-aware linting：抓 deprecated API 使用
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vitest.setup.jsx'],
        },
        tsconfigRootDir: __dirname,
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
    },
  },

  // 10. Prettier 相容：關掉所有與 Prettier 衝突的格式規則
  prettier,

  // 11. 忽略的檔案和資料夾
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'public/**',
      '*.config.js',
      '*.config.mjs',
      '**/*.d.ts',
    ],
  },

  // 12. Next.js Route Handlers must use named exports (GET, POST, etc.)
  {
    files: ['**/app/api/**/route.js'],
    rules: {
      'import/prefer-default-export': 'off',
    },
  },

  // 12.5 src/lib/** uses named exports for SDK mirror + cross-lib consistency
  //      Rationale: All lib modules are namespace starting points. Named export
  //      aligns with Firebase SDK API style (import { getDocs } from ...),
  //      maintains cross-lib consistency, and improves IDE auto-import.
  //      Four historical disables removed in this commit — promoting the
  //      decision from per-file disable annotations to config level.
  {
    files: ['src/lib/**/*.{js,jsx}'],
    rules: {
      'import/prefer-default-export': 'off',
    },
  },

  // 13. Structural tests: src/lib/ must not import UI layers
  //     Rationale: Constitution Principle II — lib is a pure service layer.
  {
    files: ['src/lib/**/*.{js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'src/lib/ is a pure service layer — do not import React.' },
            {
              name: 'react-dom',
              message: 'src/lib/ is a pure service layer — do not import React.',
            },
          ],
          patterns: [
            {
              group: ['next/*'],
              message: 'src/lib/ is a pure service layer — do not import Next.',
            },
            {
              group: ['react-leaflet', 'react-leaflet/*'],
              message: 'src/lib/ must not depend on UI libraries.',
            },
          ],
        },
      ],
    },
  },

  // 14. Structural tests: UI integration layers must delegate Firebase access to src/lib/
  //     Rationale: Constitution Principle II — UI layer (app/components/hooks/contexts)
  //     must not import Firebase SDK directly. Pattern 'firebase/*' covers firestore, auth,
  //     storage, and all future SDK submodules. Bare 'firebase-admin' package is NOT matched
  //     (gitignore-glob requires '/' separator), allowing legitimate server-side use in
  //     src/app/api/**/route.js.
  {
    files: [
      'src/app/**/*.{js,jsx}',
      'src/components/**/*.{js,jsx}',
      'src/hooks/**/*.{js,jsx}',
      'src/contexts/**/*.{js,jsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['firebase/*'],
              message:
                'UI integration layers (src/app, src/components, src/hooks, src/contexts) must call src/lib/firebase-*.js helpers instead of importing Firebase SDK directly. See Constitution Principle II.',
            },
          ],
        },
      ],
    },
  },

  // 18. 針對測試檔案的嚴格規範
  {
    files: [
      'tests/**/*.{js,jsx,mjs}',
      '**/*.test.{js,jsx,mjs}',
      '**/*.spec.{js,jsx,mjs}',
      'specs/test-utils/**/*.{js,jsx,mjs}',
      'specs/**/e2e/**/*.{js,jsx,mjs}',
    ],
    rules: {
      // 開啟依賴檢查，但允許測試檔案使用 devDependencies
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],

      // 測試檔案也要求 JSDoc
      'jsdoc/require-jsdoc': 'warn',

      // 禁止使用 console.log（保持測試輸出乾淨）
      'no-console': 'error',

      // 測試輔助只 export 一個 helper 很正常
      'import/prefer-default-export': 'off',

      // Vitest 測試環境本質衝突，放寬
      'import/first': 'off',
      'no-shadow': 'off',
      'global-require': 'off',
      'no-restricted-syntax': 'off',
      'no-plusplus': 'off',
      'no-underscore-dangle': 'off',
      'class-methods-use-this': 'off',
      'no-await-in-loop': 'off',
      'react/jsx-no-constructed-context-values': 'off',

      // 測試環境 warnings
      'jsdoc/reject-any-type': 'off',
      '@next/next/no-img-element': 'off',
      'jsx-a11y/alt-text': 'off',
    },
  },
];
