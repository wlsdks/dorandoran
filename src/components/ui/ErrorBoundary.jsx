import { Component } from 'react';
import { motion } from 'framer-motion';
import { spring } from '@/lib/motion';
import { RefreshCw } from 'lucide-react';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

/**
 * React Error Boundary — catches render errors and shows a recovery UI.
 *
 * Props:
 * @param {string}  scope     — label for the boundary (e.g. "student", "admin")
 * @param {boolean} fullPage  — true → min-h-dvh centered layout (default: true)
 * @param {React.ReactNode} children
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[ErrorBoundary:${this.props.scope || 'app'}]`, error, errorInfo);
    // Dynamic import 실패 시 자동 새로고침 (배포 후 캐시 불일치)
    if (error?.message?.includes('dynamically imported module') || error?.message?.includes('Failed to fetch')) {
      window.location.reload();
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const fullPage = this.props.fullPage !== false;

    return <ErrorFallback
      fullPage={fullPage}
      errorMessage={this.state.error?.message}
      scope={this.props.scope}
      onRetry={this.handleRetry}
      onReload={this.handleReload}
    />;
  }
}

// Q1-4: scope별 사용자 친화 hint — 무엇을 해야 할지 알려줌
const SCOPE_HINT = {
  student: '강사가 다음 질문을 준비 중일 수 있어요. 잠시 후 다시 시도해보세요.',
  admin: '최근 변경 사항이 있다면 새로고침으로 반영됩니다.',
  live: '전자칠판 화면이 곧 자동으로 다시 연결됩니다.',
  report: '리포트 데이터를 다시 불러오는 중 문제가 생겼어요.',
  submit: '제출하셨던 내용은 안전하게 보관되어 있어요. 다시 시도해 주세요.',
};

/** Functional fallback UI — clean, minimal, Korean. */
function ErrorFallback({ fullPage, errorMessage, scope, onRetry, onReload }) {
  const wrapperClass = fullPage
    ? 'min-h-dvh bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6'
    : 'flex items-center justify-center p-8';
  const hint = scope && SCOPE_HINT[scope];

  return (
    <div className={wrapperClass}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.gentle}
        className="text-center max-w-sm"
      >
        {/* Mascot */}
        <div className="flex justify-center mb-4">
          <DoranDoranMascot size="md" mood="thinking" />
        </div>

        {/* Message */}
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 mb-1">
          문제가 발생했습니다
        </h2>
        <p className={`text-sm text-slate-400 leading-relaxed ${hint ? 'mb-2' : 'mb-6'}`}>
          일시적인 오류가 발생했어요. 다시 시도해 주세요.
        </p>
        {hint && (
          <p className="text-sm text-slate-500 dark:text-slate-300 leading-relaxed mb-6">
            {hint}
          </p>
        )}

        {/* Error detail (dev only — collapsed) */}
        {errorMessage && (
          <details className="mb-6 text-left">
            <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-500 transition-colors duration-150">
              오류 상세
            </summary>
            <pre className="mt-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
              {errorMessage}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-medium py-2.5 px-5 rounded-lg transition-colors duration-150 text-sm"
          >
            <RefreshCw size={15} />
            다시 시도
          </button>
          <button
            onClick={onReload}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium py-2.5 px-5 rounded-lg border border-slate-200 dark:border-slate-600 transition-colors duration-150 text-sm"
          >
            페이지 새로고침
          </button>
        </div>
      </motion.div>
    </div>
  );
}
