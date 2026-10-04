import { createContext, useContext } from 'react';

export const AI_UNAVAILABLE = Object.freeze({ status: 'unknown', configured: false, available: false,
  studentFeaturesAvailable: false, reason: 'AI 연결을 확인하고 있어요.', refresh: () => {} });
export const AIAvailabilityContext = createContext(AI_UNAVAILABLE);
export function useAIAvailability() { return useContext(AIAvailabilityContext); }
