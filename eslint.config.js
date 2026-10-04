import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react,
    },
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react/jsx-uses-vars': 'error',
      // React 19 strict rule이 Firebase onValue subscription, useMediaQuery SSR sync,
      // mount trigger(`setMounted(true)` after `useEffect(() => {}, [])`)같은
      // 정당한 패턴까지 false positive로 잡아 노이즈 큼. 진짜 anti-pattern(예: props sync)은
      // 코드 리뷰 + case-by-case로 처리하는 게 신호 대 잡음 비가 더 좋음.
      'react-hooks/set-state-in-effect': 'off',
      // useMemo 안에서 Date.now() / Math.random() 호출도 잡음. 시각 효과(파티클 burst)나
      // day 단위 카운트다운처럼 useMemo로 "한 번만 평가"가 의도된 케이스에선 false positive.
      // 진짜 stale closure 위험은 case-by-case 코드 리뷰로 잡음.
      'react-hooks/purity': 'off',
    },
  },
  {
    // Firebase Functions run as CommonJS on Node.js.
    files: ['functions/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
  },
  {
    // Node.js 환경 — config / 시드 스크립트 / e2e 테스트
    files: ['vite.config.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.{js,mjs}', 'playwright.config.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
