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
import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import testingLibrary from 'eslint-plugin-testing-library';
import confusingGlobals from 'confusing-browser-globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const unitRuntimeApiServiceRepoFlakyBaselineForCombinedBlocks = [
  'tests/unit/repo/firebase-users.test.js',
  'tests/unit/repo/firebase-weather-favorites.test.js',
  'tests/unit/runtime/sync-strava-activities.test.js',
];

const unitLibFlakyBaselineForCombinedBlocks = [
  'tests/unit/lib/create-post-validation.test.js',
  'tests/unit/lib/deletePost.test.js',
  'tests/unit/lib/firebase-comments.test.js',
  'tests/unit/lib/firebase-events-002-jsdoc.test.js',
  'tests/unit/lib/firebase-events-edit-delete.test.js',
  'tests/unit/lib/firebase-events.test.js',
  'tests/unit/lib/firebase-member.test.js',
  'tests/unit/lib/firebase-posts-comments-likes.test.js',
  'tests/unit/lib/firebase-posts-crud.test.js',
  'tests/unit/lib/firebase-profile.test.js',
];

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
      'jsdoc/require-jsdoc': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns-description': 'error',
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
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-expect-error': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],
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

  // 15. Ban eslint-disable for a11y rules (Constitution IX: No ESLint Abuse)
  //     Agent remediation: fix the HTML structure (add roles, labels, key handlers)
  //     instead of disabling a11y rules.
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      '@eslint-community/eslint-comments': eslintCommentsPlugin,
    },
    rules: {
      '@eslint-community/eslint-comments/no-restricted-disable': ['error', 'jsx-a11y/*'],
    },
  },

  // 17.5 testing-library 規則（Constitution: testing-standards.md）
  //      Rationale: integration tests must use userEvent (not fireEvent),
  //      query by role/label (not container.querySelector). Mechanical guard
  //      so reviewers don't have to enforce manually.
  //      e2e (Playwright) 不在 scope — Playwright 的 page.getByX() 是官方推薦寫法，
  //      與 React Testing Library 的 screen.getByX() 是兩個不同生態。Plugin 只認
  //      method shape 不認 library 來源，否則會誤報 187+ 處 false positive。
  {
    files: ['tests/**/*.{js,jsx,mjs}', '**/*.test.{js,jsx,mjs}', '**/*.spec.{js,jsx,mjs}'],
    ignores: [
      'tests/e2e/**',
      'tests/_helpers/e2e-helpers.js',
      'tests/_helpers/notifications/scroll-to-comment-mock.jsx',
    ],
    ...testingLibrary.configs['flat/react'],
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
      // Session 4 前置設定已恢復 no-node-access sensor；
      // 後續 Phase 4 清 baseline violations，避免增量 commit gate 再放行 DOM access。
      'testing-library/prefer-user-event': 'error',
      'testing-library/no-node-access': 'error',
    },
  },

  // 18. 針對測試檔案的嚴格規範
  {
    files: ['tests/**/*.{js,jsx,mjs}', '**/*.test.{js,jsx,mjs}', '**/*.spec.{js,jsx,mjs}'],
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

  // 18.5 flaky-pattern (audit P1-4 / P1-5 / R7 / spec 026 S6) — fires on tests/**
  //      NOTE: positioned AFTER block 18 (the strict-test block whose
  //      'no-restricted-syntax': 'off' would otherwise override this rule
  //      via flat-config last-write-wins). Attempt 3 / option (B') per T35.
  //      Baseline start: 45 (S4 grep frozen, S6-effective via T33 (C))
  //      退場條件: Wave 3 cleanup → S8 trigger (ignores → empty)
  //      Per T33 (C): 只擋 toHaveBeenCalledTimes，setTimeout 維度交給 S4 grep
  //      gate 監督，S8 觸發型升級成 AST custom plugin。
  {
    files: ['tests/**/*.{js,jsx,mjs}'],
    ignores: [
      'tests/integration/comments/event-comment-notification.test.jsx',
      'tests/integration/dashboard/useDashboardTab.test.jsx',
      'tests/integration/events/EventActionButtons.test.jsx',
      'tests/integration/events/EventCardMenu.test.jsx',
      'tests/integration/events/EventDeleteConfirm.test.jsx',
      'tests/integration/events/EventEditForm.test.jsx',
      'tests/integration/events/ShareButton.test.jsx',
      'tests/integration/navbar/NavbarDesktop.test.jsx',
      'tests/integration/navbar/NavbarMobile.test.jsx',
      'tests/integration/notifications/NotificationPaginationStateful.test.jsx',
      'tests/integration/notifications/NotificationPanel.test.jsx',
      'tests/integration/posts/ComposeModal.test.jsx',
      'tests/integration/profile/BioEditor.test.jsx',
      'tests/integration/profile/ProfileClient.test.jsx',
      'tests/integration/strava/CallbackPage.test.jsx',
      'tests/integration/strava/RunCalendarDialog.test.jsx',
      'tests/integration/strava/RunsActivityList.test.jsx',
      'tests/integration/strava/RunsPage.test.jsx',
      'tests/integration/strava/useStravaSync.test.jsx',
      'tests/integration/toast/toast-container.test.jsx',
      'tests/integration/toast/toast-ui.test.jsx',
      'tests/integration/weather/township-drilldown.test.jsx',
      'tests/integration/weather/weather-page.test.jsx',
      'tests/unit/lib/create-post-validation.test.js',
      'tests/unit/lib/deletePost.test.js',
      'tests/unit/lib/firebase-comments.test.js',
      'tests/unit/lib/firebase-events-002-jsdoc.test.js',
      'tests/unit/lib/firebase-events-edit-delete.test.js',
      'tests/unit/lib/firebase-events.test.js',
      'tests/unit/lib/firebase-member.test.js',
      'tests/unit/lib/firebase-notifications-read.test.js',
      'tests/unit/lib/firebase-notifications-write.test.js',
      'tests/unit/lib/firebase-posts-comments-likes.test.js',
      'tests/unit/lib/firebase-posts-crud.test.js',
      'tests/unit/lib/firebase-profile.test.js',
      'tests/unit/lib/notify-event-new-comment.test.js',
      'tests/unit/lib/notify-post-comment-reply.test.js',
      'tests/unit/repo/firebase-profile-server.test.js',
      'tests/unit/repo/firebase-users.test.js',
      'tests/unit/repo/firebase-weather-favorites.test.js',
      'tests/unit/runtime/notification-use-cases.test.js',
      'tests/unit/runtime/post-use-cases.test.js',
      'tests/unit/runtime/profile-events-runtime.test.js',
      'tests/unit/runtime/sync-strava-activities.test.js',
      'tests/unit/runtime/useStravaActivities.test.jsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toHaveBeenCalledTimes']",
          message:
            "Use toHaveBeenLastCalledWith / toHaveBeenNthCalledWith / waitFor instead of toHaveBeenCalledTimes(N) — count assertions are flaky under async timing.\nRefs: project-health/2026-04-29-tests-audit-report.md P1-4 (L293-318) / P1-5 (L293-318) / R7 (L552-556).\nIf this file is in the S6 flaky-pattern baseline ignores list (frozen S6-effective baseline ⊆ 45), the rule won't fire; new violations outside baseline must be removed (Wave 3 trigger).\nFor 'new Promise + setTimeout' sleep patterns the S6 ESLint rule does NOT lint — S4 grep gate (scripts/audit-flaky-patterns.sh) keeps monitoring; S8 trigger upgrades it to AST custom plugin.",
        },
      ],
    },
  },

  // 18.6 mock-boundary + flaky combined (audit P0-1 / R6 / P1-4 / P1-5 / R7 / spec 026 S6 / spec 027 S0) — integration override; replaces 18.5 for tests/integration/** so mock selectors are not nuked by rule-level overwrite.
  //      Baseline start: 55 = 47 (spec 026 baseline) + 8 (spec 027 S0 selector expansion).
  //      退場條件: Wave 3 cleanup → S8 trigger (ignores → empty)
  //      Selectors: disallow vi.mock('@/lib|repo|service/...') and vi.mock('@/runtime/...') except providers.
  //      Flaky selector duplicated here because flat-config rule overrides at rule-name level.
  {
    files: ['tests/integration/**/*.{js,jsx,mjs}'],
    ignores: [
      'tests/integration/dashboard/useDashboardTab.test.jsx',
      'tests/integration/events/EventActionButtons.test.jsx',
      'tests/integration/events/EventCardMenu.test.jsx',
      'tests/integration/events/EventDeleteConfirm.test.jsx',
      'tests/integration/events/EventEditForm.test.jsx',
      'tests/integration/events/ShareButton.test.jsx',
      'tests/integration/posts/ComposeModal.test.jsx',
      'tests/integration/strava/CallbackPage.test.jsx',
      'tests/integration/strava/RunCalendarDialog.test.jsx',
      'tests/integration/strava/RunsActivityCard.test.jsx',
      'tests/integration/strava/RunsActivityList.test.jsx',
      'tests/integration/strava/RunsPage.test.jsx',
      'tests/integration/strava/RunsRouteMap.test.jsx',
      'tests/integration/strava/runs-page-sync-error.test.jsx',
      'tests/integration/strava/useStravaSync.test.jsx',
      'tests/integration/toast/crud-toast.test.jsx',
      'tests/integration/toast/toast-container.test.jsx',
      'tests/integration/toast/toast-ui.test.jsx',
      'tests/integration/weather/favorites.test.jsx',
      'tests/integration/weather/township-drilldown.test.jsx',
      'tests/integration/weather/weather-page.test.jsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='Literal'][arguments.0.value=/^@\\/(lib|repo|service)\\//]",
          message:
            "Integration tests must not vi.mock('@/lib|repo|service/...') — exercise real repo code and mock only external boundaries.\nRefs: project-health/2026-04-29-tests-audit-report.md P0-1 (L77-111) / R6 (L552-556).\nIf this file is in the S0 block 18.6 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.\nFor dynamic / aliased paths the rule cannot reach you — reviewer must catch in PR.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='Literal'][arguments.0.value=/^@\\/runtime\\/(?!providers\\/)/]",
          message:
            "Integration tests must not vi.mock('@/runtime/...') except '@/runtime/providers/*' React provider boundaries.\nRefs: project-health/2026-04-29-tests-audit-report.md P0-1 (L77-111) / R6 (L552-556).\nIf this file is in the S0 block 18.6 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.\nFor dynamic / aliased paths the rule cannot reach you — reviewer must catch in PR.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.cooked=/^@\\/(lib|repo|service)\\//]",
          message:
            "Integration tests must not vi.mock('@/lib|repo|service/...') — exercise real repo code and mock only external boundaries.\nRefs: project-health/2026-04-29-tests-audit-report.md P0-1 (L77-111) / R6 (L552-556).\nIf this file is in the S0 block 18.6 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.\nFor dynamic / aliased paths the rule cannot reach you — reviewer must catch in PR.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.cooked=/^@\\/runtime\\/(?!providers\\/)/]",
          message:
            "Integration tests must not vi.mock('@/runtime/...') except '@/runtime/providers/*' React provider boundaries.\nRefs: project-health/2026-04-29-tests-audit-report.md P0-1 (L77-111) / R6 (L552-556).\nIf this file is in the S0 block 18.6 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.\nFor dynamic / aliased paths the rule cannot reach you — reviewer must catch in PR.",
        },
        {
          selector: "CallExpression[callee.property.name='toHaveBeenCalledTimes']",
          message:
            "Use toHaveBeenLastCalledWith / toHaveBeenNthCalledWith / waitFor instead of toHaveBeenCalledTimes(N) — count assertions are flaky under async timing.\nRefs: project-health/2026-04-29-tests-audit-report.md P1-4 (L293-318) / P1-5 (L293-318) / R7 (L552-556).\nIf this file is in the S6 flaky-pattern baseline ignores list (frozen S6-effective baseline ⊆ 45), the rule won't fire; new violations outside baseline must be removed (Wave 3 trigger).\nFor 'new Promise + setTimeout' sleep patterns the S6 ESLint rule does NOT lint — S4 grep gate (scripts/audit-flaky-patterns.sh) keeps monitoring; S8 trigger upgrades it to AST custom plugin.",
        },
      ],
    },
  },

  // 18.7 mock-boundary + flaky combined (spec 027 S0) — unit runtime/api/service/repo baseline.
  //      Combined block intentionally duplicates 18.5 flaky selector because flat-config
  //      replaces `no-restricted-syntax` arrays at rule-name level.
  //      Baseline start: 14.
  {
    files: ['tests/unit/{runtime,api,service,repo}/**/*.{js,jsx,mjs}'],
    ignores: [
      ...unitRuntimeApiServiceRepoFlakyBaselineForCombinedBlocks,
      'tests/unit/api/strava-callback-route.test.js',
      'tests/unit/api/strava-disconnect-route.test.js',
      'tests/unit/api/strava-sync-route.test.js',
      'tests/unit/api/strava-webhook-route.test.js',
      'tests/unit/api/sync-token-revocation.test.js',
      'tests/unit/api/weather-api-route.test.js',
      'tests/unit/repo/firebase-profile-server.test.js',
      'tests/unit/runtime/notification-use-cases.test.js',
      'tests/unit/runtime/post-use-cases.test.js',
      'tests/unit/runtime/profile-events-runtime.test.js',
      'tests/unit/runtime/useStravaActivities.test.jsx',
      'tests/unit/runtime/useStravaConnection.test.jsx',
      'tests/unit/service/profile-service.test.js',
      'tests/unit/service/weather-forecast-service.test.js',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='Literal'][arguments.0.value=/^@\\/(lib|repo|service)\\//]",
          message:
            "Unit tests in this cleanup baseline must not vi.mock('@/lib|repo|service/...') — mock SDKs, browser APIs, or external service boundaries instead.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.7 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='Literal'][arguments.0.value=/^@\\/runtime\\/(?!providers\\/)/]",
          message:
            "Unit tests in this cleanup baseline must not vi.mock('@/runtime/...') except '@/runtime/providers/*' React provider boundaries.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.7 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.cooked=/^@\\/(lib|repo|service)\\//]",
          message:
            "Unit tests in this cleanup baseline must not vi.mock('@/lib|repo|service/...') — mock SDKs, browser APIs, or external service boundaries instead.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.7 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.cooked=/^@\\/runtime\\/(?!providers\\/)/]",
          message:
            "Unit tests in this cleanup baseline must not vi.mock('@/runtime/...') except '@/runtime/providers/*' React provider boundaries.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.7 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector: "CallExpression[callee.property.name='toHaveBeenCalledTimes']",
          message:
            "Use toHaveBeenLastCalledWith / toHaveBeenNthCalledWith / waitFor instead of toHaveBeenCalledTimes(N) — count assertions are flaky under async timing.\nRefs: project-health/2026-04-29-tests-audit-report.md P1-4 (L293-318) / P1-5 (L293-318) / R7 (L552-556).\nIf this file is in the S6 flaky-pattern baseline ignores list (frozen S6-effective baseline ⊆ 45), the rule won't fire; new violations outside baseline must be removed (Wave 3 trigger).\nFor 'new Promise + setTimeout' sleep patterns the S6 ESLint rule does NOT lint — S4 grep gate (scripts/audit-flaky-patterns.sh) keeps monitoring; S8 trigger upgrades it to AST custom plugin.",
        },
      ],
    },
  },

  // 18.8 mock-boundary + flaky combined (spec 027 S0) — unit lib baseline.
  //      Combined block intentionally duplicates 18.5 flaky selector because flat-config
  //      replaces `no-restricted-syntax` arrays at rule-name level.
  //      Baseline start: 5.
  {
    files: ['tests/unit/lib/**/*.{js,jsx,mjs}'],
    ignores: [
      ...unitLibFlakyBaselineForCombinedBlocks,
      'tests/unit/lib/fetch-distinct-comment-authors.test.js',
      'tests/unit/lib/firebase-notifications-read.test.js',
      'tests/unit/lib/firebase-notifications-write.test.js',
      'tests/unit/lib/notify-event-new-comment.test.js',
      'tests/unit/lib/notify-post-comment-reply.test.js',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='Literal'][arguments.0.value=/^@\\/(lib|repo|service)\\//]",
          message:
            "Unit lib tests in this cleanup baseline must not vi.mock('@/lib|repo|service/...') — mock SDKs, browser APIs, or external service boundaries instead.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.8 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='Literal'][arguments.0.value=/^@\\/runtime\\/(?!providers\\/)/]",
          message:
            "Unit lib tests in this cleanup baseline must not vi.mock('@/runtime/...') except '@/runtime/providers/*' React provider boundaries.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.8 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.cooked=/^@\\/(lib|repo|service)\\//]",
          message:
            "Unit lib tests in this cleanup baseline must not vi.mock('@/lib|repo|service/...') — mock SDKs, browser APIs, or external service boundaries instead.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.8 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector:
            "CallExpression[callee.object.name='vi'][callee.property.name='mock'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.cooked=/^@\\/runtime\\/(?!providers\\/)/]",
          message:
            "Unit lib tests in this cleanup baseline must not vi.mock('@/runtime/...') except '@/runtime/providers/*' React provider boundaries.\nRefs: specs/027-tests-mock-cleanup/plan.md S0 / project-health/2026-04-29-tests-audit-report.md P0-1.\nIf this file is in the S0 block 18.8 baseline ignores list, the rule won't fire; new violations outside baseline must be removed.",
        },
        {
          selector: "CallExpression[callee.property.name='toHaveBeenCalledTimes']",
          message:
            "Use toHaveBeenLastCalledWith / toHaveBeenNthCalledWith / waitFor instead of toHaveBeenCalledTimes(N) — count assertions are flaky under async timing.\nRefs: project-health/2026-04-29-tests-audit-report.md P1-4 (L293-318) / P1-5 (L293-318) / R7 (L552-556).\nIf this file is in the S6 flaky-pattern baseline ignores list (frozen S6-effective baseline ⊆ 45), the rule won't fire; new violations outside baseline must be removed (Wave 3 trigger).\nFor 'new Promise + setTimeout' sleep patterns the S6 ESLint rule does NOT lint — S4 grep gate (scripts/audit-flaky-patterns.sh) keeps monitoring; S8 trigger upgrades it to AST custom plugin.",
        },
      ],
    },
  },

  // 19. File size limits (D2: mechanical enforcement)
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/config/geo/**'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
];
