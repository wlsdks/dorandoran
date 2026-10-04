import { GoogleGenAI } from '@google/genai';
import { auth, getStaffSession } from '@/lib/auth-session';

const PROXY_URL = (import.meta.env.VITE_GEMINI_PROXY_URL || '/api/gemini').replace(/\/$/, '');
import { AI_ENABLED, AI_DISABLED_MESSAGE, hasVerifiedAIConfiguration } from '@/lib/ai-config';
export { AI_ENABLED, AI_DISABLED_MESSAGE } from '@/lib/ai-config';
let client = null;
export function isGeminiConfigured() { return Boolean(AI_ENABLED && getStaffSession() && hasVerifiedAIConfiguration(auth.currentUser?.uid)); }

/** 공식 GenAI SDK를 서버 프록시로만 연결한다. 브라우저에는 실제 API 키를 두지 않는다. */
export function getGeminiModel({ model, generationConfig = {}, systemInstruction, safetySettings }) {
  if (!isGeminiConfigured()) throw new Error(AI_DISABLED_MESSAGE);
  if (!PROXY_URL) throw new Error('Gemini 프록시가 비활성화되어 있습니다.');
  if (new URL(PROXY_URL, window.location.origin).origin !== window.location.origin) throw new Error('AI 프록시는 서비스와 같은 출처에 있어야 합니다.');
  if (!client) client = new GoogleGenAI({ apiKey: 'proxied-no-key-in-client', httpOptions: {
    baseUrl: new URL(PROXY_URL, window.location.origin).href, apiVersion: 'v1beta',
  } });
  return {
    async generateContent(request) {
      if (!auth.currentUser) throw new Error('승인된 강사 로그인이 필요합니다.');
      const payload = typeof request === 'string' || Array.isArray(request) ? { contents: request } : request;
      const result = await client.models.generateContent({ model, contents: payload.contents,
        config: { ...generationConfig, ...payload.generationConfig, systemInstruction: payload.systemInstruction || systemInstruction,
          safetySettings: payload.safetySettings || safetySettings, httpOptions: { headers: { Authorization: `Bearer ${await auth.currentUser.getIdToken()}` } } },
      });
      return { response: { text: () => result.text || '' } };
    },
  };
}
