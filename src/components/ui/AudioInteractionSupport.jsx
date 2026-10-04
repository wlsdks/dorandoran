import { useEffect } from 'react';
import { unlockNotificationAudio } from '@/lib/chime';

/** 모바일 Safari에서도 소리 준비는 실제 사용자의 클릭 안에서만 한다. */
export default function AudioInteractionSupport() {
  useEffect(() => {
    const unlock = event => { if (event.isTrusted) unlockNotificationAudio(); };
    document.addEventListener('click', unlock);
    return () => document.removeEventListener('click', unlock);
  }, []);
  return null;
}
