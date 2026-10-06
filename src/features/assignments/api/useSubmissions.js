import { csvCell } from '@/lib/csv-cell';
import { authenticatedRequest } from '@/lib/auth-session';
import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { EMPTY_RECORD } from '@/lib/realtime';
import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { logger } from '@/lib/logger';
import { JUDGES } from '@/lib/judging/judges';

/**
 * useSubmissionList — 과제의 제출물 목록 구독.
 */
export function useSubmissionList(assignmentId) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId) { setSubmissions([]); setLoading(false); return; }

    const subsRef = ref(db, `assignments/${assignmentId}/submissions`);
    const unsub = onValue(subsRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
      setSubmissions(list);
      setLoading(false);
    }, (err) => {
      logger.error('제출물 목록 로드 실패:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [assignmentId]);

  return { submissions, loading, count: submissions.length };
}

/**
 * submitWork — 학생이 과제를 제출.
 * 같은 이름이면 기존 제출물을 업데이트.
 * 신 폼: prdContent(텍스트) + screenshots(URL 배열) + code(HTML, 선택).
 */
export async function submitWork(assignmentId, { name, pin, prdContent, screenshots, code }, options = {}) {
  const result = await authenticatedRequest('/api/assignments/submit', { assignmentId, name, pin, prdContent, screenshots, code, allowUpdate: options.allowUpdate === true });
  if (result.error) throw new Error(result.error);
  return result.id;
}

/**
 * lookupSubmission — 이름 + 비밀번호로 제출물 조회 (비회원 주문 조회 방식).
 */
/** 조회 실패 문구 — 요청이 너무 잦아 막힌 것(429)과 연결 문제를 구분한다. */
export function lookupErrorMessage(err) {
  if (err?.status === 429) {
    const seconds = err.retryAfter;
    return seconds ? `조회 시도가 많아요. ${seconds}초 후 다시 시도해주세요.` : '조회 시도가 많아요. 잠시 후 다시 시도해주세요.';
  }
  return '조회하지 못했어요. 연결을 확인하고 다시 시도해주세요.';
}

export async function lookupSubmission(assignmentId, name, pin) {
  return authenticatedRequest('/api/assignments/lookup', { assignmentId, name, pin });
}

/**
 * withdrawSubmission — 제출물 취소 (삭제).
 */
export async function withdrawSubmission(assignmentId, submissionId) {
  await authenticatedRequest('/api/assignments/withdraw', { assignmentId, submissionId });
}

/**
 * exportResultsCSV — 심사 결과를 CSV로 다운로드.
 * BOM 포함하여 한국어 Excel 호환.
 */
export function exportResultsCSV(submissions, results, passThreshold = 3) {
  const header = ['순위', '이름', '평균점수', '합격', '선택수', ...JUDGES.map(j => j.name), 'URL'];

  const sorted = [...submissions].sort((a, b) => {
    const ra = results[a.id]?.summary?.avgScore || 0;
    const rb = results[b.id]?.summary?.avgScore || 0;
    return rb - ra;
  });

  const rows = sorted.map((sub, i) => {
    const r = results[sub.id];
    const summary = r?.summary;
    const judgeScores = JUDGES.map(j => r?.judges?.[j.id]?.score ?? '');
    const passed = summary && (summary.selectedCount ?? 0) >= passThreshold;
    return [
      i + 1,
      sub.name,
      summary?.avgScore ?? '',
      passed ? 'O' : 'X',
      summary?.selectedCount ?? '',
      ...judgeScores,
      sub.projectUrl || '',
    ];
  });

  const csvContent = [header, ...rows]
    .map(row => row.map(csvCell).join(','))
    .join('\n');

  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `심사결과_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * useSubmissionResults — 특정 제출물의 심사 결과 구독.
 */
export function useSubmissionResults(assignmentId, submissionId) {
  const { value: results, loading, error } = useRealtimeValue(assignmentId && submissionId ? `assignments/${assignmentId}/results/${submissionId}` : null);

  return { results, loading, error };
}
