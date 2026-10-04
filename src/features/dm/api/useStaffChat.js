import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';

/** 스태프 외 역할은 구독과 전송을 모두 비활성화한다. */
export function useStaffChat(sessionId, { enabled = true } = {}) {
  return useRealtimeMessages(sessionId, 'staffChat', { enabled, limit: 100 });
}
