import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, UserX, Clock, ShieldCheck, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const h12 = hours % 12 || 12;
  return `${month}/${day} ${ampm} ${h12}:${minutes}`;
}

function PendingAdminRow({ admin, onApprove, onReject, index }) {
  const [confirming, setConfirming] = useState(null);

  async function handleAction(action) {
    if (confirming === action) {
      if (action === 'approve') await onApprove(admin.uid);
      if (action === 'reject') await onReject(admin.uid);
      setConfirming(null);
    } else {
      setConfirming(action);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-700"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-slate-600">
            {(admin.displayName || admin.username || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
            {admin.displayName || admin.username}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>@{admin.username}</span>
            <span className="flex items-center gap-0.5">
              <Clock size={10} />
              {formatDate(admin.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        {confirming === 'reject' ? (
          <>
            <span className="text-xs text-red-500 font-medium">거절할까요?</span>
            <Button
              onClick={() => handleAction('reject')}
              variant="danger"
              size="sm"
            >
              확인
            </Button>
            <button
              onClick={() => setConfirming(null)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150 p-1"
            >
              <X size={14} />
            </button>
          </>
        ) : confirming === 'approve' ? (
          <>
            <span className="text-xs text-slate-600 font-medium">승인할까요?</span>
            <Button
              onClick={() => handleAction('approve')}
              variant="primary"
              size="sm"
            >
              확인
            </Button>
            <button
              onClick={() => setConfirming(null)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150 p-1"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <Button
              onClick={() => handleAction('approve')}
              variant="primary"
              size="sm"
            >
              <UserCheck size={14} />
              승인
            </Button>
            <Button
              onClick={() => handleAction('reject')}
              variant="ghost"
              size="sm"
            >
              <UserX size={14} />
              거절
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminApproval({ pendingAdmins, pendingCount, approveAdmin, rejectAdmin }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={event => {
          // Safari pointer clicks do not always focus a plain button. Record
          // this opener before Modal captures the focus it must restore.
          event.currentTarget.focus({ preventScroll: true });
          setOpen(true);
        }}
        className="relative flex max-sm:min-h-11 max-sm:min-w-11 items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm transition-colors duration-150 active:scale-[0.96]"
        aria-label="관리자 승인 관리"
      >
        <ShieldCheck size={18} />
        {pendingCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] min-h-[18px]">
            {pendingCount}
          </span>
        )}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-slate-700" />
              <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100">관리자 승인</h2>
              {pendingCount > 0 && (
                <Badge variant="error">{pendingCount}명 대기</Badge>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-150"
            >
              <X size={18} />
            </button>
          </div>

          {/* List */}
          {pendingAdmins.length === 0 ? (
            <div className="text-center py-8">
              <ShieldCheck size={32} className="text-slate-500 dark:text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">대기 중인 승인 요청이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {pendingAdmins.map((admin, i) => (
                  <PendingAdminRow
                    key={admin.uid}
                    admin={admin}
                    onApprove={approveAdmin}
                    onReject={rejectAdmin}
                    index={i}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
