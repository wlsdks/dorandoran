import { realtimeDiagnostics } from './tests/support/realtime-diagnostics.mjs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import compression from 'vite-plugin-compression'
import path from 'path'
import { fileURLToPath } from 'node:url'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

/**
 * Gemini API 키가 다시 번들로 새는 것을 막는 가드.
 *
 * `VITE_` 접두사가 붙은 값은 Vite가 빌드 타임에 공개 JS로 인라인한다. 2026-07-02에
 * VITE_GEMINI_API_KEY가 정확히 이 경로로 유출됐고, 그래서 키는 서버
 * 프록시로 옮겼다. 누군가 편의상 .env에 키를 되돌려놓으면 조용히 다시
 * 유출되므로, 그런 빌드는 아예 실패시킨다.
 */
function forbidGeminiKeyInBundle(mode) {
  return {
    name: 'forbid-gemini-key-in-bundle',
    enforce: 'pre',
    buildStart() {
      const env = loadEnv(mode, process.cwd(), 'VITE_')
      if (env.VITE_GEMINI_API_KEY) {
        throw new Error(
          '\n\n[보안] VITE_GEMINI_API_KEY가 설정되어 있습니다.\n' +
          'VITE_ 변수는 공개 번들에 평문으로 인라인됩니다 — 키가 그대로 유출됩니다.\n' +
          'Gemini 키는 Firebase Functions Secret Manager에만 두세요.\n' +
          '.env에서 VITE_GEMINI_API_KEY를 지우고 VITE_GEMINI_PROXY_URL을 쓰세요.\n' +
          '자세한 내용: SECURITY.md\n'
        )
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [
    forbidGeminiKeyInBundle(mode),
    ...(mode === 'qa' ? [realtimeDiagnostics()] : []),
    react(),
    tailwindcss(),
    // Brotli pre-compression — ~15-25% smaller than gzip
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
    // Gzip fallback for older clients
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(srcDir),
    },
  },
  server: {
    // 프로덕션에서는 Hosting rewrite가 /api/gemini → geminiProxy로 보낸다.
    // 로컬에서는 Functions 에뮬레이터로 직접 넘긴다:
    //   firebase emulators:start --only functions
    proxy: Object.fromEntries([['staff', 'staffApi'], ['assignments', 'assignmentApi'], ['classroom', 'classroomApi'], ['gemini', 'geminiProxy']].map(([prefix, handler]) => [
      `/api/${prefix}`, { target: 'http://127.0.0.1:5001', changeOrigin: false,
        rewrite: path => path.replace(new RegExp(`^/api/${prefix}`), `/${loadEnv(mode, process.cwd(), 'VITE_').VITE_FIREBASE_PROJECT_ID}/asia-northeast3/${handler}`),
      },
    ])),
  },
  // 순수 로직 단위 테스트 (vitest) — node 환경, 빠름. 리팩터 안전망.
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'vendor-react';
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'vendor-firebase';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'vendor-motion';
          if (id.includes('lucide-react') || id.includes('qrcode.react')) return 'vendor-ui';
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
        },
      },
    },
  },
}))
