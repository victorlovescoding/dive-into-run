// eslint.config.mjs
// ESLint 9 Flat Config - 使用官方 FlatCompat 包裝 Airbnb 規則
import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-config-prettier';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  // ESLint 官方推薦規則
  js.configs.recommended,

  // Airbnb 規則（使用官方 FlatCompat 轉換）
  ...fixupConfigRules(compat.extends('airbnb', 'airbnb/hooks')),

  // Next.js 規則
  ...fixupConfigRules(compat.extends('next/core-web-vitals')),

  // JSDoc 規則
  jsdoc.configs['flat/recommended'],

  // 專案自訂設定
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      // ===== 與專案現有程式碼相容的調整 =====

      // console.log 警告，但允許 console.warn / console.error（錯誤紀錄用途）
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // 允許未使用的變數被標記為警告而非錯誤
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // React: 不強制 prop-types（我們用 JSDoc）
      'react/prop-types': 'off',

      // React: 允許 JSX 在 .js 檔案中
      'react/jsx-filename-extension': ['warn', { extensions: ['.js', '.jsx'] }],

      // React: 不強制 default props
      'react/require-default-props': 'off',

      // React: 允許展開 props
      'react/jsx-props-no-spreading': 'off',

      // React: React 17+ (Next.js) 不再需要引入 React
      'react/react-in-jsx-scope': 'off',

      // Import: 允許 devDependencies 在測試檔案中
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
            '**/playwright.config.js',
            '**/playwright.config.mjs',
            '**/.claude/skills/**/*.js',
            '**/.gemini/skills/**/*.js',
          ],
        },
      ],

      // Import: 關閉副檔名檢查（Next.js 不需要）
      'import/extensions': 'off',

      // Import: 關閉路徑解析（讓 Next.js 處理 @/ 別名）
      'import/no-unresolved': 'off',

      // JSDoc: 調整為警告
      'jsdoc/require-jsdoc': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
    },
  },

  // Prettier 相容：關閉所有與 Prettier 衝突的格式規則
  prettier,

  // 忽略的檔案和資料夾
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'public/**',
      '*.config.js',
      '*.config.mjs',
    ],
  },
 // 針對測試檔案的嚴格規範
  {
    // 鎖定目標：測試資料夾與所有測試副檔名
    files: [
      'tests/**/*.js',
      'tests/**/*.jsx',
      '**/*.test.js',
      '**/*.spec.js',
    ],
    rules: {
      // 1. 開啟依賴檢查，但允許測試檔案使用 devDependencies (比 off 更安全！)
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],

      // 2. 測試檔案也要求 JSDoc (這條如果不習慣，隨時可以改成 'off')
      'jsdoc/require-jsdoc': 'warn',

      // 3. 禁止使用 console.log (保持測試輸出乾淨，逼 AI 寫出乾淨的 Code)
      'no-console': 'error',
    },
  },
];
