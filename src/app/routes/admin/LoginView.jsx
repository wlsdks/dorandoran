import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motion as motionTokens } from '@/lib/design-tokens';
import { AlertCircle, LogIn } from 'lucide-react';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { hashPassword } from '@/lib/auth';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

const inputClass = (hasError) =>
  `w-full bg-white dark:bg-slate-700 border rounded-lg px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-colors duration-150 ${
    hasError
      ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
      : 'border-slate-200 dark:border-slate-600 focus:ring-indigo-500/20 focus:border-indigo-500'
  }`;

export default function LoginView({ onLogin, onSwitchToRegister }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해주세요');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const adminsSnap = await get(ref(db, 'admins'));
      const admins = adminsSnap.val() || {};

      const pwHash = await hashPassword(password);
      const entry = Object.entries(admins).find(
        ([, admin]) => admin.username === username.trim() && admin.passwordHash === pwHash
      );

      if (!entry) {
        setError('아이디 또는 비밀번호가 틀렸습니다');
        setSubmitting(false);
        return;
      }

      const [uid, admin] = entry;

      if (!admin.approved) {
        setError('관리자 승인 대기 중입니다');
        setSubmitting(false);
        return;
      }

      sessionStorage.setItem(
        'dorandoran_admin',
        JSON.stringify({
          uid,
          username: admin.username,
          displayName: admin.displayName || admin.username,
          role: admin.role,
        })
      );
      onLogin();
    } catch {
      setError('로그인 중 오류가 발생했습니다');
      setSubmitting(false);
    }
  }

  return (
    <motion.form
      key="login"
      initial={motionTokens.fadeIn.initial}
      animate={motionTokens.fadeIn.animate}
      exit={{ opacity: 0 }}
      transition={{ duration: motionTokens.duration.normal }}
      onSubmit={handleSubmit}
      className="w-full max-w-sm"
    >
      <Card className="p-10 space-y-6 overflow-visible">
        <div className="flex justify-center -mt-20 mb-4">
          <DoranDoranMascot size="lg" />
        </div>

        <div className="text-center space-y-1.5">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">도란도란</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">관리자 로그인</p>
        </div>

        <div className="space-y-4">
          <input type="text" value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}

            placeholder="아이디" aria-label="아이디"
            className={inputClass(!!error)}
            autoComplete="username" autoFocus />
          <input type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}

            placeholder="비밀번호" aria-label="비밀번호"
            className={inputClass(!!error)}
            autoComplete="current-password" />

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                className="text-red-500 text-sm text-center flex items-center justify-center gap-1.5" role="alert">
                <AlertCircle size={14} />{error}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={submitting}>
            <LogIn size={18} />{submitting ? '로그인 중...' : '로그인'}
          </Button>
        </div>

        <div className="text-center">
          <button type="button" onClick={onSwitchToRegister}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150">
            계정이 없으신가요? <span className="font-medium text-slate-700 dark:text-slate-200">회원가입</span>
          </button>
        </div>

        <div>
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 space-y-2">
            <button type="button"
              onClick={async () => {
                setSubmitting(true);
                setError('');
                try {
                  sessionStorage.setItem('dorandoran_admin',
                    JSON.stringify({ uid: 'demo', username: 'demo', displayName: '데모 사용자', role: 'admin' }));
                  onLogin();
                } catch {
                  setError('데모 로그인에 실패했습니다');
                  setSubmitting(false);
                }
              }}
              className="w-full py-2.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
              disabled={submitting}>
              강사 데모로 둘러보기
            </button>
            <button type="button"
              onClick={async () => {
                setSubmitting(true);
                setError('');
                try {
                  sessionStorage.setItem('dorandoran_admin',
                    JSON.stringify({ uid: 'staff_demo', username: 'staff_demo', displayName: '데모 스태프', role: 'staff' }));
                  onLogin();
                } catch {
                  setError('데모 로그인에 실패했습니다');
                  setSubmitting(false);
                }
              }}
              className="w-full py-2.5 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
              disabled={submitting}>
              스태프 데모로 둘러보기
            </button>
          </div>
        </div>
      </Card>
    </motion.form>
  );
}
