import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { motion as motionTokens } from '@/lib/design-tokens';
import { AlertCircle, UserPlus, ArrowRight } from 'lucide-react';
import { ref, get, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { hashPassword, generateId } from '@/lib/auth';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DoranDoranMascot from '@/components/ui/DoranDoranMascot';

const inputClass = (hasError) =>
  `w-full bg-white dark:bg-slate-700 border rounded-lg px-4 py-3 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-colors duration-150 ${
    hasError
      ? 'border-red-400 focus:ring-red-500/20 focus:border-red-500'
      : 'border-slate-200 dark:border-slate-600 focus:ring-indigo-500/20 focus:border-indigo-500'
  }`;

const ROLES = [
  { value: 'admin', label: '강사', desc: '강의를 만들고 운영합니다' },
  { value: 'staff', label: '스태프', desc: '배정된 강의를 보조합니다' },
];

export default function RegisterView({ onLogin, onSwitchToLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedUsername = username.trim();
    const trimmedName = displayName.trim();

    if (!trimmedUsername || !password || !trimmedName) {
      setError('모든 항목을 입력해주세요');
      return;
    }
    if (trimmedUsername.length < 2 || trimmedUsername.length > 20) {
      setError('아이디는 2~20자로 입력해주세요');
      return;
    }
    if (password.length < 4) {
      setError('비밀번호는 4자 이상 입력해주세요');
      return;
    }
    if (trimmedName.length > 20) {
      setError('이름은 20자 이내로 입력해주세요');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const adminsSnap = await get(ref(db, 'admins'));
      const admins = adminsSnap.val() || {};
      const existingAdmins = Object.values(admins);

      const duplicate = existingAdmins.find((a) => a.username === trimmedUsername);
      if (duplicate) {
        setError('이미 사용 중인 아이디입니다');
        setSubmitting(false);
        return;
      }

      const isFirstUser = existingAdmins.length === 0;
      const uid = generateId();
      const pwHash = await hashPassword(password);

      const role = isFirstUser ? 'master' : selectedRole;
      const isStaff = role === 'staff';

      const adminData = {
        username: trimmedUsername,
        passwordHash: pwHash,
        displayName: trimmedName,
        role,
        approved: isFirstUser || isStaff,
        createdAt: Date.now(),
      };

      await set(ref(db, `admins/${uid}`), adminData);

      if (isFirstUser) {
        sessionStorage.setItem('dorandoran_admin',
          JSON.stringify({ uid, username: trimmedUsername, displayName: trimmedName, role: 'master' }));
        onLogin();
      } else if (isStaff) {
        sessionStorage.setItem('dorandoran_admin',
          JSON.stringify({ uid, username: trimmedUsername, displayName: trimmedName, role: 'staff' }));
        onLogin();
      } else {
        setSuccess(true);
      }
    } catch {
      setError('가입 중 오류가 발생했습니다');
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }} className="w-full max-w-sm">
        <Card className="p-8 space-y-5 overflow-visible">
          <div className="flex justify-center -mt-20 mb-2">
            <DoranDoranMascot size="lg" />
          </div>
          <div className="text-center space-y-3">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.2 }}
              className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto">
              <UserPlus size={24} className="text-slate-600 dark:text-slate-300" />
            </motion.div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">가입 완료!</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
              관리자 승인 후 이용 가능합니다.<br />잠시만 기다려주세요.
            </p>
          </div>
          <Button type="button" variant="secondary" size="lg" className="w-full" onClick={onSwitchToLogin}>
            <ArrowRight size={18} />로그인으로 돌아가기
          </Button>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.form key="register" initial={motionTokens.fadeIn.initial} animate={motionTokens.fadeIn.animate}
      exit={{ opacity: 0 }} transition={{ duration: motionTokens.duration.normal }}
      onSubmit={handleSubmit} className="w-full max-w-sm">
      <Card className="p-8 space-y-5 overflow-visible">
        <div className="flex justify-center -mt-20 mb-2">
          <DoranDoranMascot size="lg" />
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">도란도란</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">관리자 회원가입</p>
        </div>

        <div className="space-y-3">
          <input type="text" value={username}
            onChange={(e) => { setUsername(e.target.value); setError(''); }}
            placeholder="아이디" aria-label="아이디"
            className={inputClass(!!error)}
            autoComplete="username" autoFocus />
          <input type="password" value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="비밀번호" aria-label="비밀번호"
            className={inputClass(!!error)}
            autoComplete="new-password" />
          <input type="text" value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setError(''); }}
            placeholder="이름" aria-label="이름"
            className={inputClass(!!error)}
            autoComplete="name" />

          {/* Role selector */}
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setSelectedRole(r.value)}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors duration-150 ${
                  selectedRole === r.value
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                }`}
              >
                <span className="block">{r.label}</span>
                <span className={`block text-xs mt-0.5 font-normal ${
                  selectedRole === r.value ? 'text-white/70 dark:text-slate-900/60' : 'text-slate-400 dark:text-slate-500'
                }`}>{r.desc}</span>
              </button>
            ))}
          </div>

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
            <UserPlus size={18} />{submitting ? '가입 중...' : '회원가입'}
          </Button>
        </div>

        <div className="text-center">
          <button type="button" onClick={onSwitchToLogin}
            className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150">
            이미 계정이 있으신가요? <span className="font-medium text-slate-700 dark:text-slate-200">로그인</span>
          </button>
        </div>
      </Card>
    </motion.form>
  );
}
