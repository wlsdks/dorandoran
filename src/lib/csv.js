import { csvCell } from './csv-cell';
/**
 * CSV export utilities for session data.
 *
 * Generates two export types:
 * 1. Question summary — one row per question with stats
 * 2. Per-participant responses — one row per participant with answers
 */

/**
 * Escapes a CSV cell value (handles commas, quotes, newlines).
 * @param {*} value
 * @returns {string}
 */
const escapeCSV = csvCell;

/**
 * Converts a 2D array to a CSV string with BOM for Excel compatibility.
 * @param {Array<Array<string>>} rows
 * @returns {string}
 */
function toCSVString(rows) {
  const BOM = '\uFEFF';
  return BOM + rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
}

/**
 * Triggers a browser download of a CSV file.
 * @param {string} csvString
 * @param {string} filename
 */
function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Builds a sorted array of questions from the session.
 * @param {object} questions - session.questions object from Firebase
 * @returns {Array<{id: string, data: object}>}
 */
function getSortedQuestions(questions) {
  return Object.entries(questions || {})
    .map(([id, data]) => ({ id, data }))
    .sort((a, b) => (a.data.order || 0) - (b.data.order || 0));
}

// Imported from question-types.js but aliased to match existing usage
import { TYPE_LABELS as QTYPE_LABELS } from '@/lib/question-types';
import { isAnswerCorrect } from '@/lib/quiz';

/**
 * Exports question-level summary CSV.
 *
 * Columns: 번호, 질문, 유형, 선택지, 정답, 응답수, 응답률(%), 정답률(%), 선택지별 분포
 *
 * @param {object} session
 * @param {object} participants - { pid: { nickname, ... } }
 * @param {string} filename
 */
export function exportQuestionSummary(session, participants, filename) {
  const sorted = getSortedQuestions(session?.questions);
  const participantCount = Object.keys(participants || {}).length;

  const header = ['번호', '질문', '유형', '선택지', '정답', '응답 수', '응답률(%)', '정답률(%)', '자신감 분포', '선택지별 분포'];
  const rows = [header];

  sorted.forEach((q, i) => {
    const { data } = q;

    // aiJudge: votes가 아닌 submissions/aiTop3 경로를 쓴다 → 별도 집계
    if (data.type === 'aiJudge') {
      const submissions = data.submissions || {};
      const subCount = Object.keys(submissions).length;
      const responseRate = participantCount > 0 ? Math.round((subCount / participantCount) * 100) : 0;
      const top3 = data.aiTop3 || {};
      const topStr = ['first', 'second', 'third']
        .map((k, idx) => {
          const w = top3[k];
          if (!w) return null;
          const rank = ['1등', '2등', '3등'][idx];
          const score = typeof w.score === 'number' ? w.score.toFixed(1) : '-';
          return `${rank}: ${w.name} (${score})`;
        })
        .filter(Boolean)
        .join(' / ');
      rows.push([
        i + 1,
        data.title || '',
        QTYPE_LABELS[data.type] || data.type,
        '',
        '',
        subCount,
        responseRate,
        '',
        '',
        topStr || '심사 미완료',
      ]);
      return;
    }

    const votes = data.votes || {};
    const voteCount = Object.keys(votes).length;
    const responseRate = participantCount > 0 ? Math.round((voteCount / participantCount) * 100) : 0;

    const options = (data.options || []).join(' / ');
    const correctAnswer = data.correctAnswer || '';

    let correctRate = '';
    if (data.correctAnswer && voteCount > 0) {
      // 텍스트형은 대소문자·띄어쓰기 무시, 객관식은 정확 일치.
      const correctCount = Object.values(votes).filter((v) => isAnswerCorrect(data, v.value)).length;
      correctRate = Math.round((correctCount / voteCount) * 100);
    }

    // Distribution: count per option value
    const dist = {};
    Object.values(votes).forEach((v) => {
      const val = v.value || '(없음)';
      dist[val] = (dist[val] || 0) + 1;
    });
    const distStr = Object.entries(dist)
      .map(([val, cnt]) => `${val}: ${cnt}명`)
      .join(', ');

    // Confidence distribution
    const confCounts = { high: 0, medium: 0, low: 0 };
    Object.values(votes).forEach((v) => {
      if (v.confidence) confCounts[v.confidence]++;
    });
    const confTotal = confCounts.high + confCounts.medium + confCounts.low;
    const confStr = confTotal > 0
      ? `확신 ${confCounts.high}, 보통 ${confCounts.medium}, 낮음 ${confCounts.low}`
      : '';

    rows.push([
      i + 1,
      data.title || '',
      QTYPE_LABELS[data.type] || data.type,
      options,
      correctAnswer,
      voteCount,
      responseRate,
      correctRate,
      confStr,
      distStr,
    ]);
  });

  downloadCSV(toCSVString(rows), filename);
}

/**
 * Exports per-participant response CSV.
 *
 * Columns: 닉네임, [Q1 title], [Q2 title], ..., 총점
 *
 * @param {object} session
 * @param {object} participants - { pid: { nickname, ... } }
 * @param {object} scores - { pid: { total, nickname } }
 * @param {string} filename
 */
export function exportParticipantResponses(session, participants, scores, filename) {
  const sorted = getSortedQuestions(session?.questions);
  const hasScores = Object.keys(scores || {}).length > 0;

  // Header: 닉네임 (+ 사번, 기업 행사모드) + question titles + optional score columns
  const pids = Object.keys(participants || {});
  const hasEmployeeId = pids.some((pid) => participants[pid]?.employeeId);
  const header = ['닉네임', ...(hasEmployeeId ? ['사번'] : [])];
  sorted.forEach((q, i) => {
    header.push(`Q${i + 1}. ${q.data.title || ''}`);
  });
  if (hasScores) {
    header.push('총점');
  }

  const rows = [header];

  // Build a row per participant
  pids.forEach((pid) => {
    const p = participants[pid];
    const nickname = p?.nickname || scores?.[pid]?.nickname || pid;
    const row = [nickname, ...(hasEmployeeId ? [p?.employeeId || ''] : [])];

    sorted.forEach((q) => {
      // aiJudge는 votes 대신 submissions 경로를 본다
      if (q.data.type === 'aiJudge') {
        const sub = q.data.submissions?.[pid];
        const result = q.data.aiResults?.[pid];
        const avg = result?.summary?.avgScore;
        if (sub) {
          const parts = [sub.title || '(제목없음)'];
          if (typeof avg === 'number') parts.push(`${avg.toFixed(1)}점`);
          row.push(parts.join(' · '));
        } else {
          row.push('');
        }
        return;
      }
      const vote = q.data.votes?.[pid];
      const betSuffix = q.data.betting && vote?.bet && parseInt(vote.bet, 10) > 1
        ? ` (${vote.bet}x)` : '';
      const confSuffix = vote?.confidence ? ` [${vote.confidence === 'high' ? '확신' : vote.confidence === 'medium' ? '보통' : '낮음'}]` : '';
      row.push(vote?.value ? `${vote.value}${betSuffix}${confSuffix}` : '');
    });

    if (hasScores) {
      const s = scores[pid];
      row.push(s?.total ?? 0);
    }

    rows.push(row);
  });

  downloadCSV(toCSVString(rows), filename);
}

/**
 * Generates a safe filename prefix from session metadata.
 * @param {object} session
 * @returns {string}
 */
export function getFilenamePrefix(session) {
  const course = (session?.courseName || '도란도란').replace(/[/\\?%*:|"<>]/g, '_');
  const round = session?.roundNumber ? `_${session.roundNumber}차` : '';
  return `${course}${round}`;
}
