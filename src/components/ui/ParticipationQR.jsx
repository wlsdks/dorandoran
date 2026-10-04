import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import Modal from './Modal';
import QRCode from './QRCode';
import Button from './Button';

/** 같은 QR 대화상자를 발표자와 전자칠판에서 사용한다. 항상 슬라이드보다 위에 표시한다. */
export default function ParticipationQR({ open, onClose, url, sessionId, count = 0 }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true); clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1800);
    } catch { /* QR 스캔으로 계속 참여할 수 있다. */ }
  };
  return <Modal open={open} onClose={onClose} ariaLabel="수업 참여 QR" size="lg" centered theme="dark">
    <div className="flex items-center justify-between gap-4 mb-5">
      <div><h2 className="text-xl sm:text-2xl font-bold text-slate-100">함께 참여하세요</h2>
        <p className="text-sm sm:text-base text-slate-300 mt-1">휴대폰 카메라로 QR을 스캔해주세요</p></div>
      <button onClick={onClose} aria-label="참여 QR 닫기" className="h-12 w-12 shrink-0 flex items-center justify-center rounded-xl bg-slate-700 text-slate-100"><X size={22} /></button>
    </div>
    <div className="participation-qr flex justify-center"><QRCode url={url} size={420} /></div>
    <div className="text-center mt-5 space-y-2">
      <p className="text-slate-100 text-xl font-semibold break-all">{sessionId}</p>
      <p className="text-slate-300 text-base">{count}명 참여 중</p>
      <p className="text-slate-400 text-sm break-all">{url}</p>
      <Button variant="secondary" size="lg" onClick={copy} className="mt-2"><span aria-hidden="true">{copied ? <Check size={18} /> : <Copy size={18} />}</span>{copied ? '복사했어요' : '참여 링크 복사'}</Button>
    </div>
  </Modal>;
}
