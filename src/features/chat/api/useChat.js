import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';

/** 최근 200개만 구독하고, 전송 시작 시점부터 중복 입력을 막는다. */
export function useChat(sessionId) {
  return useRealtimeMessages(sessionId, 'chat', { limit: 200 });
}
