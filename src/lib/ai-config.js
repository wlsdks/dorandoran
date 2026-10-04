export const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true';
export const AI_DISABLED_MESSAGE = 'AI 연결과 수업 사용 설정을 확인해주세요.';

let verifiedConfiguration = null;
export function setVerifiedAIConfiguration(uid, available) { verifiedConfiguration = uid ? { uid, available: available === true } : null; }
export function clearVerifiedAIConfiguration(uid) { if (!uid || verifiedConfiguration?.uid === uid) verifiedConfiguration = null; }
export function hasVerifiedAIConfiguration(uid) { return Boolean(uid && verifiedConfiguration?.uid === uid && verifiedConfiguration.available); }
